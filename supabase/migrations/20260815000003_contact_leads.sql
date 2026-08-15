-- Public website lead capture. No auth or secrets are required for prospects.
create table if not exists public.contact_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  company text check (company is null or char_length(trim(company)) between 2 and 160),
  message text not null check (char_length(trim(message)) between 10 and 3000),
  source text not null default 'website' check (source = 'website'),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed', 'spam')),
  created_at timestamptz not null default now()
);

alter table public.contact_leads enable row level security;

revoke all on public.contact_leads from anon, authenticated;
grant insert on public.contact_leads to anon, authenticated;

drop policy if exists contact_leads_insert_public on public.contact_leads;
create policy contact_leads_insert_public
on public.contact_leads
for insert
to anon, authenticated
with check (source = 'website');
