-- public.apply_workflow_run_transition was created in 20260917000011 with
-- `security definer` and granted to `authenticated` only. Its header assumed
-- service_role "keeps its implicit access", but that assumption does not hold:
-- the function-level default privileges for schema public grant EXECUTE to
-- postgres alone, and function EXECUTE is independent of the table privileges
-- and BYPASSRLS that service_role does hold.
--
-- The n8n callback path authenticates with the service-role key
-- (src/lib/automation/callback-service.ts -> createAdminClient()), so its
-- supabase.rpc("apply_workflow_run_transition", ...) call resolves to the
-- service_role database role and fails with 42501 ("permission denied for
-- function apply_workflow_run_transition"). The same gap already affects
-- create_organization and handle_new_user, but no service_role path calls
-- those, so this migration scopes itself to the one function that is actually
-- invoked as service_role.
--
-- Scope: one GRANT. No function body, signature, ownership or SECURITY DEFINER
-- setting is changed, and anon retains no EXECUTE.

grant execute on function public.apply_workflow_run_transition(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  jsonb,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  integer,
  timestamptz,
  text
) to service_role;