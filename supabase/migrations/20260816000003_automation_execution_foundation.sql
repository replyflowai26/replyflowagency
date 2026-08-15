-- ReplyFlow AI automation execution foundation
-- Execution is intentionally queue-first: this layer records durable runs.
-- n8n/worker execution is a later adapter and must never bypass tenant RLS.

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  project_id uuid not null references public.automation_projects(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual', 'schedule', 'webhook', 'system')),
  requested_by uuid references auth.users(id) on delete set null,
  external_execution_id text,
  idempotency_key text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, idempotency_key),
  foreign key (workflow_id, organization_id)
    references public.workflows(id, organization_id)
    on delete cascade,
  foreign key (project_id, organization_id)
    references public.automation_projects(id, organization_id)
    on delete cascade
);

create table if not exists public.workflow_run_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null,
  event_type text not null check (event_type ~ '^[a-z0-9_.:-]{2,80}$'),
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (run_id, organization_id)
    references public.workflow_runs(id, organization_id)
    on delete cascade
);

create index if not exists workflow_runs_org_created_idx
  on public.workflow_runs (organization_id, created_at desc);
create index if not exists workflow_runs_workflow_created_idx
  on public.workflow_runs (workflow_id, created_at desc);
create index if not exists workflow_runs_status_idx
  on public.workflow_runs (organization_id, status, created_at desc);
create index if not exists workflow_run_events_run_created_idx
  on public.workflow_run_events (run_id, created_at asc);

-- Only one queued/running execution may exist for a workflow when an idempotency
-- key is supplied. Null keys remain reusable for manual runs.
create unique index if not exists workflow_runs_org_idempotency_idx
  on public.workflow_runs (organization_id, idempotency_key)
  where idempotency_key is not null;

-- Keep updated_at consistent with the existing Company OS trigger function.
drop trigger if exists workflow_runs_set_updated_at on public.workflow_runs;
create trigger workflow_runs_set_updated_at
before update on public.workflow_runs
for each row execute function public.set_updated_at();

-- Tenant identity must never change after a run is created.
drop trigger if exists workflow_runs_prevent_org_reassignment on public.workflow_runs;
create trigger workflow_runs_prevent_org_reassignment
before update on public.workflow_runs
for each row execute function private.prevent_org_reassignment();

drop trigger if exists workflow_run_events_no_update on public.workflow_run_events;
create trigger workflow_run_events_no_update
before update or delete on public.workflow_run_events
for each row execute function private.prevent_audit_mutation();

alter table public.workflow_runs enable row level security;
alter table public.workflow_run_events enable row level security;

-- Members can inspect executions in their own workspace.
drop policy if exists workflow_runs_select_member on public.workflow_runs;
create policy workflow_runs_select_member
on public.workflow_runs for select to authenticated
using ((select private.is_org_member(organization_id, (select auth.uid()))));

-- Members can request a run, but the request must be attributed to themselves.
drop policy if exists workflow_runs_insert_member on public.workflow_runs;
create policy workflow_runs_insert_member
on public.workflow_runs for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and (select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member']))
);

-- Status/output mutation is reserved for owner/admin/member server workers.
-- RLS still enforces workspace membership; future service workers should use
-- a narrowly scoped server-side credential rather than exposing it to clients.
drop policy if exists workflow_runs_update_member on public.workflow_runs;
create policy workflow_runs_update_member
on public.workflow_runs for update to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member'])))
with check ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member'])));

-- Runs are retained for auditability; users cannot delete execution history.
drop policy if exists workflow_runs_delete_none on public.workflow_runs;
create policy workflow_runs_delete_none
on public.workflow_runs for delete to authenticated
using (false);

-- Run events are append-only and visible only to workspace members.
drop policy if exists workflow_run_events_select_member on public.workflow_run_events;
create policy workflow_run_events_select_member
on public.workflow_run_events for select to authenticated
using ((select private.is_org_member(organization_id, (select auth.uid()))));

drop policy if exists workflow_run_events_insert_member on public.workflow_run_events;
create policy workflow_run_events_insert_member
on public.workflow_run_events for insert to authenticated
with check ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member'])));

drop policy if exists workflow_run_events_delete_none on public.workflow_run_events;
create policy workflow_run_events_delete_none
on public.workflow_run_events for delete to authenticated
using (false);

comment on table public.workflow_runs is 'Durable automation execution requests and outcomes. Queue-first; external execution is adapter-owned.';
comment on table public.workflow_run_events is 'Append-only execution event stream for observability and audit.';
