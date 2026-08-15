-- ReplyFlow AI Company OS foundation
-- Tenant model: auth.users -> profiles -> memberships -> organizations
-- All application tables are RLS protected. Secrets are never stored here.

create schema if not exists private;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_role') then
    create type public.organization_role as enum ('owner', 'admin', 'member', 'viewer');
  end if;
end
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.automation_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (id, organization_id)
);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id)
    references public.automation_projects(id, organization_id)
    on delete cascade
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  status text not null default 'pending' check (status in ('pending', 'connected', 'disabled', 'error')),
  external_account_id text,
  secret_ref text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_secret_ref_only check (
    secret_ref is null or char_length(trim(secret_ref)) between 1 and 255
  )
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'system')),
  action text not null check (action ~ '^[a-z0-9_.:-]{2,120}$'),
  entity_type text not null check (entity_type ~ '^[a-z0-9_.:-]{2,120}$'),
  entity_id uuid,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists automation_projects_org_slug_idx
  on public.automation_projects (organization_id, slug);
create index if not exists organization_memberships_user_idx
  on public.organization_memberships (user_id);
create index if not exists workflows_project_idx
  on public.workflows (project_id);
create index if not exists workflows_org_idx
  on public.workflows (organization_id);
create index if not exists integration_connections_org_idx
  on public.integration_connections (organization_id);
create index if not exists audit_events_org_created_idx
  on public.audit_events (organization_id, created_at desc);
create index if not exists audit_events_entity_idx
  on public.audit_events (entity_type, entity_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

 drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists memberships_set_updated_at on public.organization_memberships;
create trigger memberships_set_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.automation_projects;
create trigger projects_set_updated_at
before update on public.automation_projects
for each row execute function public.set_updated_at();

drop trigger if exists workflows_set_updated_at on public.workflows;
create trigger workflows_set_updated_at
before update on public.workflows
for each row execute function public.set_updated_at();

drop trigger if exists connections_set_updated_at on public.integration_connections;
create trigger connections_set_updated_at
before update on public.integration_connections
for each row execute function public.set_updated_at();

create or replace function private.is_org_member(target_org_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org_id
      and m.user_id = target_user_id
  );
$$;

create or replace function private.has_org_role(
  target_org_id uuid,
  target_user_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org_id
      and m.user_id = target_user_id
      and m.role::text = any (allowed_roles)
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid, uuid) to authenticated;
grant execute on function private.has_org_role(uuid, uuid, text[]) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.create_organization(
  organization_name text,
  organization_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if char_length(trim(organization_name)) not between 2 and 120 then
    raise exception 'invalid organization name' using errcode = '22023';
  end if;

  if organization_slug is null or organization_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid organization slug' using errcode = '22023';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (trim(organization_name), lower(organization_slug), caller_id)
  returning id into new_org_id;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (new_org_id, caller_id, 'owner');

  return new_org_id;
end;
$$;

revoke all on function public.create_organization(text, text) from public;
revoke all on function public.create_organization(text, text) from anon;
grant execute on function public.create_organization(text, text) to authenticated;

create or replace function private.prevent_org_reassignment()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_prevent_org_reassignment on public.automation_projects;
create trigger projects_prevent_org_reassignment
before update on public.automation_projects
for each row execute function private.prevent_org_reassignment();

drop trigger if exists workflows_prevent_org_reassignment on public.workflows;
create trigger workflows_prevent_org_reassignment
before update on public.workflows
for each row execute function private.prevent_org_reassignment();

drop trigger if exists connections_prevent_org_reassignment on public.integration_connections;
create trigger connections_prevent_org_reassignment
before update on public.integration_connections
for each row execute function private.prevent_org_reassignment();

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'audit_events are append-only' using errcode = '42501';
end;
$$;

drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update
before update or delete on public.audit_events
for each row execute function private.prevent_audit_mutation();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.automation_projects enable row level security;
alter table public.workflows enable row level security;
alter table public.integration_connections enable row level security;
alter table public.audit_events enable row level security;

-- Profiles: identity data only; users can read/update their own row.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Organizations: membership grants visibility; owner/admin can update.
drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
on public.organizations for select to authenticated
using ((select private.is_org_member(id, (select auth.uid()))));

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin
on public.organizations for update to authenticated
using ((select private.has_org_role(id, (select auth.uid()), array['owner','admin'])))
with check ((select private.has_org_role(id, (select auth.uid()), array['owner','admin'])));

-- Memberships: members can see memberships; owner/admin can manage them.
drop policy if exists memberships_select_member on public.organization_memberships;
create policy memberships_select_member
on public.organization_memberships for select to authenticated
using ((select private.is_org_member(organization_id, (select auth.uid()))));

drop policy if exists memberships_insert_admin on public.organization_memberships;
create policy memberships_insert_admin
on public.organization_memberships for insert to authenticated
with check ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])));

drop policy if exists memberships_update_admin on public.organization_memberships;
create policy memberships_update_admin
on public.organization_memberships for update to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])))
with check ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])));

drop policy if exists memberships_delete_admin on public.organization_memberships;
create policy memberships_delete_admin
on public.organization_memberships for delete to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])));

-- Projects: members may create/update; viewers are read-only; owner/admin may delete.
drop policy if exists projects_select_member on public.automation_projects;
create policy projects_select_member
on public.automation_projects for select to authenticated
using ((select private.is_org_member(organization_id, (select auth.uid()))));

drop policy if exists projects_insert_member on public.automation_projects;
create policy projects_insert_member
on public.automation_projects for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member']))
);

drop policy if exists projects_update_member on public.automation_projects;
create policy projects_update_member
on public.automation_projects for update to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member'])))
with check ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member'])));

drop policy if exists projects_delete_admin on public.automation_projects;
create policy projects_delete_admin
on public.automation_projects for delete to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])));

-- Workflows inherit tenant isolation through project_id + organization_id.
drop policy if exists workflows_select_member on public.workflows;
create policy workflows_select_member
on public.workflows for select to authenticated
using ((select private.is_org_member(organization_id, (select auth.uid()))));

drop policy if exists workflows_insert_member on public.workflows;
create policy workflows_insert_member
on public.workflows for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member']))
);

drop policy if exists workflows_update_member on public.workflows;
create policy workflows_update_member
on public.workflows for update to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member'])))
with check ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member'])));

drop policy if exists workflows_delete_admin on public.workflows;
create policy workflows_delete_admin
on public.workflows for delete to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])));

-- Integration connections: metadata/reference only. Secrets live in a future vault/secret manager.
drop policy if exists connections_select_member on public.integration_connections;
create policy connections_select_member
on public.integration_connections for select to authenticated
using ((select private.is_org_member(organization_id, (select auth.uid()))));

drop policy if exists connections_insert_admin on public.integration_connections;
create policy connections_insert_admin
on public.integration_connections for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin']))
);

drop policy if exists connections_update_admin on public.integration_connections;
create policy connections_update_admin
on public.integration_connections for update to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])))
with check ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])));

drop policy if exists connections_delete_admin on public.integration_connections;
create policy connections_delete_admin
on public.integration_connections for delete to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])));

-- Audit: authenticated users can append only their own events. UPDATE/DELETE are blocked by trigger.
drop policy if exists audit_events_select_member on public.audit_events;
create policy audit_events_select_member
on public.audit_events for select to authenticated
using ((select private.is_org_member(organization_id, (select auth.uid()))));

drop policy if exists audit_events_insert_member on public.audit_events;
create policy audit_events_insert_member
on public.audit_events for insert to authenticated
with check (
  actor_type = 'user'
  and actor_user_id = (select auth.uid())
  and (select private.is_org_member(organization_id, (select auth.uid())))
);

-- Minimum Data API grants; RLS remains the authorization layer.
grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select, insert, update, delete on public.automation_projects to authenticated;
grant select, insert, update, delete on public.workflows to authenticated;
grant select, insert, update, delete on public.integration_connections to authenticated;
grant select, insert on public.audit_events to authenticated;

comment on table public.integration_connections is 'Provider metadata and secret references only. Never store plaintext credentials, tokens, or provider secrets.';
comment on column public.integration_connections.secret_ref is 'Reference to an external secret manager/vault entry. Never store the secret itself.';
comment on table public.audit_events is 'Append-only organization audit log. Metadata must be redacted and free of credentials/tokens.';
