create extension if not exists pgcrypto;

create type public.organization_role as enum ('owner', 'admin', 'member', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.automation_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.automation_projects(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  display_name text not null,
  status text not null default 'pending' check (status in ('pending', 'connected', 'revoked', 'error')),
  secret_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index organization_memberships_user_id_idx on public.organization_memberships(user_id);
create index automation_projects_org_id_idx on public.automation_projects(organization_id);
create index workflows_org_id_idx on public.workflows(organization_id);
create index workflows_project_id_idx on public.workflows(project_id);
create index integration_connections_org_id_idx on public.integration_connections(organization_id);
create index audit_events_org_created_at_idx on public.audit_events(organization_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.organization_memberships for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.automation_projects for each row execute function public.set_updated_at();
create trigger workflows_set_updated_at before update on public.workflows for each row execute function public.set_updated_at();
create trigger connections_set_updated_at before update on public.integration_connections for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles public.organization_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.automation_projects enable row level security;
alter table public.workflows enable row level security;
alter table public.integration_connections enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_self on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy organizations_select_member on public.organizations
for select to authenticated using (public.is_org_member(id));
create policy organizations_insert_authenticated on public.organizations
for insert to authenticated with check (true);
create policy organizations_update_admin on public.organizations
for update to authenticated using (public.has_org_role(id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(id, array['owner','admin']::public.organization_role[]));

create policy memberships_select_member on public.organization_memberships
for select to authenticated using (public.is_org_member(organization_id));
create policy memberships_insert_admin on public.organization_memberships
for insert to authenticated with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy memberships_update_admin on public.organization_memberships
for update to authenticated using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy memberships_delete_owner on public.organization_memberships
for delete to authenticated using (public.has_org_role(organization_id, array['owner']::public.organization_role[]));

create policy projects_select_member on public.automation_projects
for select to authenticated using (public.is_org_member(organization_id));
create policy projects_insert_member on public.automation_projects
for insert to authenticated with check (public.has_org_role(organization_id, array['owner','admin','member']::public.organization_role[]));
create policy projects_update_admin_member on public.automation_projects
for update to authenticated using (public.has_org_role(organization_id, array['owner','admin','member']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','member']::public.organization_role[]));
create policy projects_delete_admin on public.automation_projects
for delete to authenticated using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy workflows_select_member on public.workflows
for select to authenticated using (public.is_org_member(organization_id));
create policy workflows_insert_member on public.workflows
for insert to authenticated with check (public.has_org_role(organization_id, array['owner','admin','member']::public.organization_role[]));
create policy workflows_update_member on public.workflows
for update to authenticated using (public.has_org_role(organization_id, array['owner','admin','member']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','member']::public.organization_role[]));
create policy workflows_delete_admin on public.workflows
for delete to authenticated using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy connections_select_member on public.integration_connections
for select to authenticated using (public.is_org_member(organization_id));
create policy connections_insert_admin on public.integration_connections
for insert to authenticated with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy connections_update_admin on public.integration_connections
for update to authenticated using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy connections_delete_admin on public.integration_connections
for delete to authenticated using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy audit_events_select_member on public.audit_events
for select to authenticated using (public.is_org_member(organization_id));
create policy audit_events_insert_member on public.audit_events
for insert to authenticated with check (public.is_org_member(organization_id));

revoke update, delete on public.audit_events from authenticated;
