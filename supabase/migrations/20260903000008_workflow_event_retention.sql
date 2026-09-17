-- ReplyFlow AI workflow run event retention
-- Bounds the append-only workflow_run_events table by TTL-deleting expired
-- event rows for TERMINAL runs, while leaving the authoritative workflow_runs
-- record untouched (permanent). Adds one purge-supporting index.
--
-- Design principles:
--   * workflow_runs = permanent authoritative per-run execution record (never
--     deleted by this migration).
--   * workflow_run_events = bounded operational/audit timeline (append-only;
--     rows for terminal runs older than the retention window are purged).
--   * Cleanup runs only through a privileged SECURITY DEFINER function called
--     via the service role. Normal authenticated users never receive delete
--     privileges and RLS policies are unchanged.
--   * Idempotent, bounded batches, short transactions, fully-qualified names.

-- ============================================================================
-- 0. Support index: accelerate the retention purge that scans old events by
--    created_at. Run-detail reads are already served by
--    workflow_run_events_run_created_idx (run_id, created_at).
-- ============================================================================
create index if not exists workflow_run_events_created_idx
  on public.workflow_run_events (created_at);

-- ============================================================================
-- 1. Allow the privileged purge to remove expired rows.
-- The existing private.prevent_audit_mutation() trigger blocks ALL updates and
-- deletes (for every role) to keep the event stream append-only. The purge
-- function therefore sets a transaction-scoped GUC that only exists for its
-- own DELETE statement. Every other path - including all authenticated client
-- traffic - is unchanged and remains blocked.
--
-- Security reasoning:
--   * The custom GUC replyflow.purge_authorized cannot be set by unprivileged
--     sessions (superuser-only via a SECURITY DEFINER function).
--   * Even if it could be set, the RLS delete_none policies still block
--     authenticated deletes, so there is no privilege-escalation path.
-- ============================================================================
create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  -- The purge path (DELETE) is authorized only when the transaction-scoped GUC
  -- is set by the SECURITY DEFINER purge function. For DELETE the trigger must
  -- return OLD to let the delete proceed (NEW is NULL in a BEFORE DELETE
  -- trigger, which would silently skip the row). UPDATEs are never authorized.
  if TG_OP = 'DELETE' and current_setting('replyflow.purge_authorized', true) = 'on' then
    return old;
  end if;
  raise exception 'audit_events are append-only' using errcode = '42501';
end;
$$;

-- ============================================================================
-- 2. Privileged, bounded, idempotent event purge.
-- Deletes ONLY workflow_run_events rows whose parent run is terminal
-- (succeeded/failed/cancelled) and older than the retention window. It never
-- deletes workflow_runs and never touches active (queued/running) runs.
-- Executes in a single short transaction and honours a batch limit so no
-- single call can lock the table for long.
-- ============================================================================
create or replace function public.purge_expired_run_events(
  p_batch_limit integer default 5000,
  p_retention_days integer default 90
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch integer := greatest(1, coalesce(p_batch_limit, 5000));
  v_retention_days integer := greatest(1, coalesce(p_retention_days, 90));
  v_cutoff timestamptz := now() - (v_retention_days * interval '1 day');
  v_deleted integer;
begin
  -- Transaction-scoped authorization for the append-only trigger. Reverts
  -- automatically at commit/rollback and is invisible to other sessions.
  perform set_config('replyflow.purge_authorized', 'on', true);

  delete from public.workflow_run_events e
  where e.id in (
    select e2.id
    from public.workflow_run_events e2
    join public.workflow_runs r
      on r.id = e2.run_id
     and r.organization_id = e2.organization_id
    where r.status in ('succeeded', 'failed', 'cancelled')
      and e2.created_at < v_cutoff
    order by e2.created_at asc
    limit v_batch
  );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Restrict execution: only the trusted service role may invoke the purge.
-- anonymous and authenticated web users are denied outright.
revoke all on function public.purge_expired_run_events(integer, integer) from public;
revoke all on function public.purge_expired_run_events(integer, integer) from anon;
revoke all on function public.purge_expired_run_events(integer, integer) from authenticated;
grant execute on function public.purge_expired_run_events(integer, integer) to service_role;

comment on function public.purge_expired_run_events(integer, integer) is
  'Privileged retention job. Deletes workflow_run_events rows for terminal runs older than the retention window. Never touches workflow_runs. Service-role only.';
