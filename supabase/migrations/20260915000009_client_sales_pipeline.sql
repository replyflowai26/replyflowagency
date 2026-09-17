-- ReplyFlow AI: Client sales pipeline tracking.
-- Additive columns on public.clients (no row changes, no RLS changes).
-- outreach_status records where a lead sits in the outreach loop;
-- next_follow_up_at tracks the next scheduled touchpoint. Both are manual
-- tracking fields only - no actual message is ever sent by this migration.

alter table public.clients
  add column if not exists outreach_status text not null default 'not_started'
    check (outreach_status in ('not_started','contacted','following_up','meeting_scheduled','closed_won','closed_lost'));

alter table public.clients
  add column if not exists next_follow_up_at timestamptz;

create index if not exists clients_org_outreach_idx
  on public.clients (organization_id, outreach_status);

create index if not exists clients_org_followup_idx
  on public.clients (organization_id, next_follow_up_at)
  where next_follow_up_at is not null;

comment on column public.clients.outreach_status is 'Current stage of the sales outreach loop. Tracking only - sending happens via a future integration adapter.';
comment on column public.clients.next_follow_up_at is 'Scheduled date for the next follow-up touchpoint. Tracking only.';