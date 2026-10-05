-- ReplyFlow AI atomic workflow run transitions
--
-- Why this migration exists
-- -----------------------
-- Until now a workflow run state transition and its audit record were two
-- independent statements issued by the application:
--
--   1. UPDATE public.workflow_runs SET status = ... (compare-and-set)
--   2. INSERT INTO public.workflow_run_events (...)
--
-- Those statements are not in a transaction together, so the process can die
-- (or the insert can be rejected) between them. The failure mode is silent and
-- permanent: the run is already terminal, and every later delivery short-circuits
-- on "already terminal", so the missing audit event is never written. The
-- execution record then claims an outcome with no evidence for it.
--
-- The recovery path had a second, related defect: it updated the run without
-- checking whether any row was actually changed, then unconditionally appended a
-- "run.failed" event. A run that a callback had already terminalized therefore
-- received an extra event describing a transition that never happened.
--
-- What this migration adds
-- ------------------------
-- A single database entry point, public.apply_workflow_run_transition(), that
-- performs the guarded transition and its audit event in ONE transaction:
--
--   - It locks the run row (SELECT ... FOR UPDATE), so two concurrent callers
--     serialize instead of interleaving.
--   - It validates the transition against the same rules the application
--     enforces in src/lib/automation/run-state-machine.ts. The database becomes
--     the final authority; the TypeScript state machine stays as the first,
--     cheapest check.
--   - It treats an already-terminal run as a no-op that returns a distinct
--     outcome and writes nothing, which is what makes duplicate and replayed
--     callbacks safe.
--   - It compares the observed status against the caller's expected status
--     (compare-and-set), so a caller that lost a race is told so instead of
--     overwriting a newer state.
--   - Because the update and the insert share one transaction, an event insert
--     that fails aborts the whole call, and the run update is rolled back with
--     it. A terminal state can no longer exist without its audit event.
--
-- Security model
-- --------------
-- The function is SECURITY DEFINER with search_path pinned to '' and every
-- object referenced fully qualified, matching the existing convention in
-- 20260815000000_company_os_foundation.sql.
--
-- It is deliberately NOT granted to anon, and it is granted to authenticated
-- only. Tenant scoping does not depend on RLS here, because SECURITY DEFINER
-- runs with the definer's rights and would otherwise bypass the existing
-- policies. Instead the function takes the organization id as an explicit
-- argument and verifies, for the calling user:
--
--   - service_role callers (the n8n callback and the cron recovery/retention
--     paths all use the service-role admin client) are trusted, exactly as they
--     already are for every other table they touch via BYPASSRLS; and
--   - every other caller must be an active member of that organization via
--     private.is_org_member(), which is the same membership predicate the RLS
--     policies use.
--
-- No existing policy, grant or role is widened, narrowed or removed. This adds
-- one new function plus one new grant.

create or replace function public.apply_workflow_run_transition(
  p_run_id uuid,
  p_organization_id uuid,
  p_to_status text,
  p_event_type text,
  p_expected_status text default null,
  p_event_message text default null,
  p_event_payload jsonb default '{}'::jsonb,
  p_external_execution_id text default null,
  p_output jsonb default null,
  p_error_code text default null,
  p_error_message text default null,
  p_completed_at timestamptz default null,
  p_started_at timestamptz default null,
  p_last_activity_at timestamptz default null,
  p_recovery_attempts integer default null,
  p_recovery_started_at timestamptz default null,
  p_recovery_error text default null
)
returns table (
  outcome text,
  run_id uuid,
  previous_status text,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.workflow_runs%rowtype;
  v_from_status text;
  v_actor_user_id uuid;
begin
  -- Resolve the acting user once. A null result means the request did not carry
  -- an authenticated identity (an anon key with no session).
  v_actor_user_id := auth.uid();

  -- The only roles that may drive this function are service_role (the internal
  -- automation paths, which are trusted with BYPASSRLS everywhere else) and an
  -- authenticated user who is a member of the target organization.
  if auth.role() <> 'service_role' then
    if v_actor_user_id is null then
      raise exception 'authentication required' using errcode = '42501';
    end if;

    if not private.is_org_member(p_organization_id, v_actor_user_id) then
      raise exception 'not a member of this organization' using errcode = '42501';
    end if;
  end if;

  -- Reject a caller-supplied status that the column check constraint would
  -- reject anyway, so the error is raised as a single, predictable condition
  -- instead of surfacing as a constraint violation from the UPDATE.
  if p_to_status not in ('queued', 'running', 'succeeded', 'failed', 'cancelled') then
    raise exception 'invalid target status' using errcode = '22023';
  end if;

  if p_expected_status is not null
     and p_expected_status not in ('queued', 'running', 'succeeded', 'failed', 'cancelled') then
    raise exception 'invalid expected status' using errcode = '22023';
  end if;

  -- The event_type column carries its own check constraint
  -- (event_type ~ '^[a-z0-9_.:-]{2,80}$'). Validate it here so a malformed
  -- event_type cannot abort the transaction after the run update has been
  -- staged.
  if p_event_type is null or p_event_type !~ '^[a-z0-9_.:-]{2,80}$' then
    raise exception 'invalid event type' using errcode = '22023';
  end if;

  -- Lock the run for the duration of the transaction. The organization id is
  -- part of the lookup key, so a caller can never address another tenant's run,
  -- and the row lock serializes competing transitions on this run.
  select r.*
    into v_run
    from public.workflow_runs r
   where r.id = p_run_id
     and r.organization_id = p_organization_id
     for update;

  if not found then
    raise exception 'workflow run not found' using errcode = 'P0002';
  end if;

  v_from_status := v_run.status;

  -- Idempotency. A run that already reached a terminal state is never moved
  -- again and never gains a second terminal event. Returning a distinct outcome
  -- lets the caller distinguish "already settled" from "I settled it" without
  -- having to re-read the row.
  if v_from_status in ('succeeded', 'failed', 'cancelled') then
    return query
      select 'already_terminal'::text, v_run.id, v_from_status, v_run.status;
    return;
  end if;

  -- Compare-and-set. A caller that passes an expected status must still be
  -- looking at that status once the row lock is held; otherwise it lost a race
  -- and must not write.
  if p_expected_status is not null and p_expected_status <> v_from_status then
    return query
      select 'status_mismatch'::text, v_run.id, v_from_status, v_run.status;
    return;
  end if;

  -- Transition validation, mirroring TRANSITIONS in
  -- src/lib/automation/run-state-machine.ts. Anything not listed there is
  -- illegal and is refused here without touching either record.
  if not (
       (v_from_status = 'queued'  and p_to_status in ('running', 'cancelled', 'failed'))
    or (v_from_status = 'running' and p_to_status in ('succeeded', 'failed', 'cancelled'))
  ) then
    return query
      select 'invalid_transition'::text, v_run.id, v_from_status, v_run.status;
    return;
  end if;

  -- Apply the transition. A no-op transition (queued -> queued is impossible
  -- per the rules above, so any same-status case is already excluded) is not
  -- reachable here.
  update public.workflow_runs r
     set status = p_to_status,
         started_at = coalesce(p_started_at, r.started_at),
         completed_at = coalesce(p_completed_at, r.completed_at),
         last_activity_at = coalesce(p_last_activity_at, now()),
         external_execution_id = coalesce(p_external_execution_id, r.external_execution_id),
         output = coalesce(p_output, r.output),
         error_code = p_error_code,
         error_message = p_error_message,
         recovery_attempts = coalesce(p_recovery_attempts, r.recovery_attempts),
         recovery_started_at = coalesce(p_recovery_started_at, r.recovery_started_at),
         recovery_error = p_recovery_error
   where r.id = p_run_id
     and r.organization_id = p_organization_id;

  -- Record the audit event in the same transaction as the transition above. If
  -- this insert fails for any reason the entire function call rolls back and
  -- the run update above is discarded, so a terminal state can never be
  -- committed without its event.
  insert into public.workflow_run_events (
    organization_id,
    run_id,
    event_type,
    message,
    payload
  )
  values (
    v_run.organization_id,
    v_run.id,
    p_event_type,
    p_event_message,
    coalesce(p_event_payload, '{}'::jsonb)
  );

  return query
    select 'applied'::text, v_run.id, v_from_status, p_to_status;
end;
$$;

comment on function public.apply_workflow_run_transition(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, text, text,
  timestamptz, timestamptz, timestamptz, integer, timestamptz, text
) is
  'Atomically applies a guarded workflow run state transition and appends its workflow_run_events audit record in one transaction. Returns already_terminal / status_mismatch / invalid_transition without writing, and applied after committing both records.';

-- Lock the function down to the same audience as every other privileged
-- routine in this schema: revoked from PUBLIC and anon, granted to
-- authenticated. service_role keeps its implicit access.
revoke all on function public.apply_workflow_run_transition(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, text, text,
  timestamptz, timestamptz, timestamptz, integer, timestamptz, text
) from public;

revoke all on function public.apply_workflow_run_transition(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, text, text,
  timestamptz, timestamptz, timestamptz, integer, timestamptz, text
) from anon;

grant execute on function public.apply_workflow_run_transition(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, text, text,
  timestamptz, timestamptz, timestamptz, integer, timestamptz, text
) to authenticated;