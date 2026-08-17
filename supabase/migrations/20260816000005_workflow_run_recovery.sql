-- ReplyFlow AI workflow run recovery foundation
-- Adds durable execution-attempt metadata so a worker can safely detect and
-- recover runs that became stuck after dispatch.

alter table public.workflow_runs
  add column if not exists attempt_count integer not null default 0
    check (attempt_count >= 0),
  add column if not exists max_attempts integer not null default 3
    check (max_attempts between 1 and 10),
  add column if not exists execution_timeout_at timestamptz,
  add column if not exists last_attempt_at timestamptz;

create index if not exists workflow_runs_recovery_idx
  on public.workflow_runs (organization_id, status, execution_timeout_at)
  where status = 'running';

comment on column public.workflow_runs.attempt_count is
  'Number of dispatch attempts made for this durable run.';
comment on column public.workflow_runs.max_attempts is
  'Maximum adapter recovery attempts allowed for this run.';
comment on column public.workflow_runs.execution_timeout_at is
  'Deadline after which a running execution is eligible for recovery.';
comment on column public.workflow_runs.last_attempt_at is
  'Timestamp of the most recent external execution attempt.';
