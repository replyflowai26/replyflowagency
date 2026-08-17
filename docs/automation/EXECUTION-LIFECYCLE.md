# Automation Execution Lifecycle

## Purpose

Define the production lifecycle for a ReplyFlow AI automation run so queued work, n8n execution, callbacks, retries, and audit history have one consistent contract.

## State machine

`queued → running → succeeded`

`queued → running → failed`

`queued → running → cancelled`

A terminal state must never be moved back to `running` by a callback.

## Request flow

1. Authenticated workspace member creates a `workflow_runs` record in `queued` state.
2. Server-side execution service verifies tenant ownership and moves the run to `running`.
3. The n8n adapter receives the workflow/run/organization identifiers and input.
4. The returned external execution ID is persisted to `workflow_runs.external_execution_id`.
5. n8n calls `/api/automation/n8n/callback` when execution reaches a terminal state.
6. The callback is authenticated with `N8N_CALLBACK_SECRET` and validated against the stored run.
7. The callback writes the terminal outcome and an append-only `workflow_run_events` record.
8. The dashboard exposes both run history and a run detail timeline for observability.

## Callback contract

Request header:

`x-n8n-callback-secret: <N8N_CALLBACK_SECRET>`

JSON body:

```json
{
  "runId": "uuid",
  "externalExecutionId": "string",
  "status": "succeeded | failed | cancelled",
  "output": {},
  "errorCode": "optional",
  "errorMessage": "optional"
}
```

## Reliability rules

- Callback authentication uses constant-time secret comparison.
- A callback must reference an existing run.
- If an external execution ID is already stored, a mismatching callback is rejected.
- Only `running` runs accept terminal transitions.
- Repeated callbacks for an already-terminal matching status are acknowledged without mutating the outcome.
- Execution history is append-only at the event layer.
- Tenant identity is taken from the stored run, never trusted from the callback payload.
- The service-role Supabase client is server-only and must never be exposed to browser code.

## Required environment

- `N8N_BASE_URL`
- `N8N_API_KEY`
- `N8N_CALLBACK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Next hardening tasks

1. Add automated unit/integration coverage for callback authentication and state transitions.
2. Add retry/backoff policy for transient n8n dispatch failures.
3. Add signed callback timestamps/nonces when the n8n deployment supports them.
4. Add queue worker/lease semantics before high-volume production execution.
5. Add metrics and alerting for stuck `running` executions.
