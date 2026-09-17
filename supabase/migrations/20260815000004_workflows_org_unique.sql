-- ReplyFlow AI — tenant-scoped uniqueness for workflows.
-- Required so the composite foreign key in
-- 20260816000003_automation_execution_foundation.sql
-- (workflow_id, organization_id) -> workflows(id, organization_id)
-- can be created (SQLSTATE 42830 otherwise).
-- Version 20260815000004 sorts after workflows is created (20260815000000)
-- and before the automation execution foundation (20260816000003).

alter table public.workflows
  add constraint workflows_org_unique unique (id, organization_id);