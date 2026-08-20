-- ReplyFlow AI workflow run recovery foundation
-- Adds durable recovery metadata for stale execution detection.
-- This migration is intentionally additive and does not change existing run semantics.

alter table public.workflow_runs
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists recovery_attempts integer not null default 0,
  add column if not exists recovery_started_at timestamptz,
  add column if not exists recovered_at timestamptz,
  add column if not exists recovery_error text;

update public.workflow_runs
set last_activity_at = coalesce(last_activity_at, updated_at, started_at, created_at, now())
where last_activity_at is null;

create index if not exists workflow_runs_recovery_idx
  on public.workflow_runs (organization_id, status, last_activity_at);

comment on column public.workflow_runs.last_activity_at is
  'Latest known activity timestamp used to detect stale executions. New runs default to creation time until execution activity is recorded.';

comment on column public.workflow_runs.recovery_attempts is
  'Number of automated recovery attempts performed for this run.';

comment on column public.workflow_runs.recovery_started_at is
  'Timestamp when the current recovery attempt started.';

comment on column public.workflow_runs.recovered_at is
  'Timestamp when recovery successfully reconciled or finalized the run.';

comment on column public.workflow_runs.recovery_error is
  'Last recovery-specific error, if recovery failed.';
