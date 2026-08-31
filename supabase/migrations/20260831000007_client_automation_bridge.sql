-- ReplyFlow AI Phase 1: Client ↔ Automation Bridge
-- Connects clients to automation projects and workflow runs via nullable FKs.
-- Adds client_activities table for append-only audit trail.
-- Production-safe: nullable columns preserve all existing rows.

-- ============================================================================
-- 0. Ensure clients(id, organization_id) is unique so that compound FKs
--    (enforcing tenant correlation) can reference it.
-- ============================================================================
create unique index if not exists clients_id_organization_uidx
  on public.clients (id, organization_id);

-- ============================================================================
-- 1. Add nullable client_id to automation_projects
-- ============================================================================
alter table public.automation_projects
  add column if not exists client_id uuid;

-- Enforce tenant correlation: the referenced client must belong to the same
-- organization as the project. Nullable so existing rows remain valid.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'automation_projects_client_org_fk'
  ) then
    alter table public.automation_projects
      add constraint automation_projects_client_org_fk
      foreign key (client_id, organization_id)
      references public.clients(id, organization_id)
      on delete set null;
  end if;
end
$$;

create index if not exists automation_projects_client_idx
  on public.automation_projects (client_id)
  where client_id is not null;

-- ============================================================================
-- 2. Add nullable client_id to workflow_runs
-- ============================================================================
alter table public.workflow_runs
  add column if not exists client_id uuid;

-- Enforce tenant correlation: the referenced client must belong to the same
-- organization as the run. Nullable so existing rows remain valid.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workflow_runs_client_org_fk'
  ) then
    alter table public.workflow_runs
      add constraint workflow_runs_client_org_fk
      foreign key (client_id, organization_id)
      references public.clients(id, organization_id)
      on delete set null;
  end if;
end
$$;

create index if not exists workflow_runs_client_idx
  on public.workflow_runs (client_id, created_at desc)
  where client_id is not null;

create index if not exists workflow_runs_org_client_idx
  on public.workflow_runs (organization_id, client_id, created_at desc)
  where client_id is not null;

-- ============================================================================
-- 3. Create client_activities table (append-only)
-- ============================================================================
create table if not exists public.client_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  activity_type text not null check (activity_type ~ '^[a-z0-9_.:-]{2,80}$'),
  title text not null check (char_length(trim(title)) between 1 and 250),
  description text,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (client_id, organization_id)
    references public.clients(id, organization_id)
    on delete cascade
);

create index if not exists client_activities_client_created_idx
  on public.client_activities (client_id, created_at desc);

create index if not exists client_activities_org_created_idx
  on public.client_activities (organization_id, created_at desc);

-- Append-only enforcement (same pattern as audit_events and workflow_run_events)
drop trigger if exists client_activities_no_update on public.client_activities;
create trigger client_activities_no_update
before update or delete on public.client_activities
for each row execute function private.prevent_audit_mutation();

-- updated_at not needed (append-only, never updated)

-- ============================================================================
-- 4. RLS for client_activities
-- ============================================================================
alter table public.client_activities enable row level security;

-- Members can read activities for clients in their organization
drop policy if exists client_activities_select_member on public.client_activities;
create policy client_activities_select_member
on public.client_activities for select to authenticated
using ((select private.is_org_member(organization_id, (select auth.uid()))));

-- Members can insert activities for clients in their organization
-- (Server-side code controls activity creation via service-role where appropriate,
--  but authenticated members can also create activities directly)
drop policy if exists client_activities_insert_member on public.client_activities;
create policy client_activities_insert_member
on public.client_activities for insert to authenticated
with check ((select private.is_org_member(organization_id, (select auth.uid()))));

-- No updates or deletes allowed (append-only enforced by trigger + RLS)
drop policy if exists client_activities_delete_none on public.client_activities;
create policy client_activities_delete_none
on public.client_activities for delete to authenticated
using (false);

-- ============================================================================
-- 5. Grants
-- ============================================================================
grant select, insert on public.client_activities to authenticated;

-- ============================================================================
-- 6. Comments
-- ============================================================================
comment on table public.client_activities is 'Append-only activity log for client operations. Records status changes, workflow associations, and user actions.';
comment on column public.automation_projects.client_id is 'Optional association to a client. Null for unassigned projects.';
comment on column public.workflow_runs.client_id is 'Optional association to a client. Null for unassociated runs.';
