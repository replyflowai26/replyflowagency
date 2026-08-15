-- Client intake captured during workspace onboarding.
-- Sensitive credentials/secrets must never be collected here.
create table if not exists public.client_intake_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  contact_name text not null check (char_length(trim(contact_name)) between 2 and 120),
  company_name text not null check (char_length(trim(company_name)) between 2 and 160),
  website_url text,
  industry text check (industry is null or char_length(trim(industry)) <= 120),
  company_size text check (company_size is null or company_size in ('solo','2-10','11-50','51-200','201-500','500+')),
  country text,
  timezone text,
  business_description text,
  primary_goal text,
  biggest_problem text,
  current_tools text[] not null default '{}',
  requested_services text[] not null default '{}',
  monthly_budget numeric(12,2) check (monthly_budget is null or monthly_budget >= 0),
  budget_currency char(3) not null default 'USD' check (budget_currency ~ '^[A-Z]{3}$'),
  timeline text check (timeline is null or timeline in ('asap','2-4-weeks','1-3-months','3-months+','exploring')),
  lead_volume text,
  sales_channels text[] not null default '{}',
  automation_readiness text check (automation_readiness is null or automation_readiness in ('new','some-automation','advanced')),
  notes text,
  intake_completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_intake_profiles enable row level security;

drop policy if exists client_intake_select_member on public.client_intake_profiles;
create policy client_intake_select_member
on public.client_intake_profiles for select to authenticated
using ((select private.is_org_member(organization_id, (select auth.uid()))));

drop policy if exists client_intake_insert_admin on public.client_intake_profiles;
create policy client_intake_insert_admin
on public.client_intake_profiles for insert to authenticated
with check ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])));

drop policy if exists client_intake_update_admin on public.client_intake_profiles;
create policy client_intake_update_admin
on public.client_intake_profiles for update to authenticated
using ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])))
with check ((select private.has_org_role(organization_id, (select auth.uid()), array['owner','admin'])));

grant select, insert, update on public.client_intake_profiles to authenticated;

drop trigger if exists client_intake_profiles_set_updated_at on public.client_intake_profiles;
create trigger client_intake_profiles_set_updated_at
before update on public.client_intake_profiles
for each row execute function public.set_updated_at();
