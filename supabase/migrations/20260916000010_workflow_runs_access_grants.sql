-- workflow_runs and workflow_run_events were created with RLS policies in
-- 20260816000003 but never received the explicit table grants that every other
-- business table has. Without grants PostgREST returns 42501 ("permission denied
-- for table workflow_runs") before RLS can even evaluate, breaking every
-- authenticated read in the dashboard (project detail, runs list, run detail,
-- telemetry) and the queue/run-path via run-actions.
--
-- This migration adds the minimal grants that the existing RLS policies assume:
--   workflow_runs      → authenticated can read, queue (insert), and update status
--   workflow_run_events → authenticated can read and append (insert/update/delete
--                         are blocked by the prevent_audit_mutation trigger anyway)

-- workflow_runs: select (page reads), insert (run-actions queue), update (status)
grant select, insert, update on public.workflow_runs to authenticated;

-- workflow_run_events: select (run detail timeline), insert (execution-service,
--   recovery-service, run-actions audit)
grant select, insert on public.workflow_run_events to authenticated;
