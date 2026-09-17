alter table public.workflows
  add column if not exists n8n_workflow_id text,
  add column if not exists n8n_webhook_path text;

create unique index if not exists workflows_n8n_workflow_id_idx
  on public.workflows (n8n_workflow_id)
  where n8n_workflow_id is not null;

create index if not exists workflows_n8n_webhook_path_idx
  on public.workflows (n8n_webhook_path)
  where n8n_webhook_path is not null;