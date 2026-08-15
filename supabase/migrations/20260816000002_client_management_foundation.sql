-- ReplyFlow AI client management foundation.
-- Client records are tenant-scoped and intentionally separate from onboarding intake.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  contact_name text,
  email text check (email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text,
  website_url text,
  industry text,
  status text not null default 'lead' check (status in ('lead','prospect','active','paused','completed','archived')),
  source text,
  notes text,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_org_idx on public.clients (organization_id);
create index if not exists clients_org_status_idx on public.clients (organization_id, status);
create index if not exists clients_org_created_idx on public.clients (organization_id, created_at desc);

alter table public.clients enable row level security;

drop policy if exists clients_select_member on public.clients;
create policy clients_select_member
on public.clients for select to authenticated
using ((select private.is_org_member(organization_id, (select auth.uid()))));

drop policy if exists clients_insert_member on public.clients;
create policy clients_insert_member
on public.clients for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member']))
);

drop policy if exists clients_update_member on public.clients;
create policy clients_update_member
on public.clients for update to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member'])))
with check ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin','member'])));

drop policy if exists clients_delete_admin on public.clients;
create policy clients_delete_admin
on public.clients for delete to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])));

grant select, insert, update, delete on public.clients to authenticated;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();
