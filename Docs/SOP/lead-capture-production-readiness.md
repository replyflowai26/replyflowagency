# Lead Capture — Production Readiness Checklist

> Internal engineering reference. This is the honest list of what must be true
> before the lead-capture slice is switched on for a real client. Nothing here
> changes infrastructure on its own; each item is a deliberate, reviewed step.

Status legend: ✅ already true · ⚠️ requires action before go-live · ⛔ known gap.

## 1. Code, tests and type-safety

- ✅ `npm run test:bridge` passes (lead-capture, agent, recovery and runtime suites).
- ✅ `npx tsc --noEmit` passes.
- ✅ `npx eslint` passes on the changed files.
- ✅ Every state change goes through the atomic transition RPC
  (`apply_workflow_run_transition`) with a compare-and-set, so a concurrent actor
  cannot double-deliver.
- ✅ The inbound endpoint enforces a body-size cap (32 KB) by both `Content-Length`
  and the actual byte length.
- ✅ Hot-lead approvals have an authenticated server action
  (`resolveLeadApprovalAction` in
  `src/app/dashboard/projects/[id]/runs/[runId]/approval-actions.ts`). It resolves
  the actor from the session, requires an owner/admin role, reads the run through
  the RLS client, and delegates to `resolveLeadApproval`. Authorization rules and
  outcome mapping live in the pure, fully unit-tested
  `src/lib/automation/lead-approval-core.ts`; `tests/lead-approval.test.ts`
  covers unauthenticated, non-admin, cross-tenant, stale/duplicate, concurrent
  and adapter-failure paths. Since task 60, every approval decision's audit
  event also records the acting approver's user id
  (`decided_by_user_id`, session-derived, payload-only — `null` on
  non-authenticated test/demo paths), so client sign-off can verify WHO
  approved each send.
- ✅ The action is wired to the dashboard. The run page
  (`src/app/dashboard/projects/[id]/runs/[runId]/page.tsx`) derives an
  owner/admin `canApprove` flag from the session and renders
  `lead-approval-controls.tsx` only while the run is `queued` with a `pending`
  gate. The controls submit only `projectId`/`runId`/`decision`, disable
  double-submit, surface the server's safe error text, and refresh the displayed
  run through the existing snapshot action after a confirmed result.
- ✅ Run observability reads `approval_state` and falls back to `none` on a
  database where the approval migration has not yet been applied, so the run page
  keeps rendering pre-migration.

## 2. Database migrations (prepared locally, NOT applied)

See `lead-capture-migration-preflight.md` for the ordered, reviewed procedure.

- ⚠️ `20261005000000_workflow_run_approval_state.sql` — adds
  `workflow_runs.approval_state` (+ partial index). **Required**: without it the
  hot-lead gate cannot persist `pending` and the recovery sweep cannot exclude it.
- ⚠️ `20261006000000_agent_runtime_foundation.sql` — the agent tables. Required
  only if the Operations Assistant is enabled for the client.
- ⚠️ `20261007000000_restrict_workflow_run_transition_and_approval.sql` — tightens
  `apply_workflow_run_transition` to owner/admin and adds a guard trigger that
  refuses non-approver writes to `approval_state`. **Depends on
  `20261005000000`.** Rehearsed against the local stack (applies cleanly; ledger
  matches) and verified against a real local database with signed-in users.
- ⚠️ Confirm the execution-foundation migration that creates `workflow_runs` /
  `workflow_run_events` and the transition RPC is present in the target database.
- ⛔ Migrations must be applied through the normal reviewed path; do **not** apply
  them to production as a side effect of this change.

## 3. Secrets and configuration

- ⚠️ `REPLYFLOW_LEAD_INTAKE_SECRET` set (otherwise the endpoint returns `503`).
- ⚠️ `REPLYFLOW_CRM_WEBHOOK_URL` **and** `REPLYFLOW_CRM_WEBHOOK_SECRET` set for the
  client's CRM. The URL must be absolute `https` (http only for loopback); it is
  rejected if it embeds credentials.
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` present for server-side writes (already required
  by the rest of the backend).
- ⚠️ Optional AI: `REPLYFLOW_AI_API_KEY` / `_BASE_URL` / `_MODEL` (and optional
  `_TIMEOUT_MS` / `_MAX_RETRIES`) if the Operations Assistant should use a real
  model. With none set it uses the deterministic planner.
- ✅ No new secret is exposed to the client bundle; all of the above are
  server-only.

## 4. Tenant isolation & authorization

- ✅ `workflow_runs`/`workflow_run_events` are reachable only through the
  service-role admin client server-side; RLS is the backstop for direct access.
- ✅ Composite foreign keys (`workflow_id`, `project_id` → `organization_id`) mean
  a run can only reference a workflow/project inside the same organization, so a
  signed intake envelope cannot cross tenants.
- ⚠️ **Known gap:** the inbound intake secret is a single shared secret, not
  per-tenant. A holder of the secret can address any `organization_id`. Mitigation
  today is the composite-FK rejection plus a dedicated secret per sender. For
  multi-tenant production, move to per-organization signing keys.
- ✅ The approval-resolution path now has an authenticated caller: the owner/admin
  server action `resolveLeadApprovalAction`. It never trusts a client-supplied
  organization id, role, user id, status or approval state; it derives all of
  those server-side, refuses a stale/duplicate decision, and never dispatches on
  rejection.
- ✅ **Authorization-boundary hardening (prepared in
  `20261007000000`; NOT yet applied to production):**
  - The `apply_workflow_run_transition` RPC now authorizes only owner/admin (or
    service_role) instead of any member. No application code ever called the RPC
    through the authenticated branch, so this is a pure tightening.
  - A `workflow_runs` guard trigger refuses a change to `approval_state` unless
    the caller is service_role or an owner/admin of the row's organization, so a
    member can no longer falsify the gate through PostgREST.
  - Both were verified against a real local database with signed-in users: member
    and cross-tenant callers are rejected, owner calls succeed, an unauthenticated
    caller is refused, `service_role` stays trusted, non-approval column updates
    are unaffected, and no RLS policy or grant is weakened.
- ⚠️ **Residual (out of scope, unchanged):** the inbound intake secret is a single
  shared secret (per-tenant signing is a future step), and the guard trigger
  protects the gate column while leaving the rest of the `workflow_runs` row
  member-writable exactly as before.

## 5. Observability and operations

- ⚠️ Confirm the recovery sweep is scheduled (internal cron endpoint) so a run
  stuck in `running` past the dispatch timeout is failed, and confirm it excludes
  `approval_state = 'pending'`.
- ✅ Logs never contain lead PII; body correlation uses a non-reversible
  fingerprint.
- ⚠️ Agree alerting on `run.failed` and on `INTEGRATION_DELIVERY_FAILED` volume.
- ⚠️ Agree an on-call owner for failed deliveries and a manual replay procedure
  (the CRM `idempotency-key` makes a safe re-delivery possible).

## 6. Client-facing sign-off

- ⚠️ Confirm the qualification thresholds and signals.
- ⚠️ Confirm the single inbound channel and the single destination.
- ⚠️ Confirm who may approve hot leads and the expected response time.
- ⚠️ Confirm data-processing expectations (what PII is stored, where, for how
  long — see the retention endpoint).

## 7. Explicitly out of scope until separately built

- ⛔ n8n dispatch/dispatch-callback path for lead runs (runs are executed
  synchronously today).
- ⛔ Outbound lead **response** automation (email/SMS/WhatsApp sends) — the
  external-action adapter is deliberately unconfigured; see
  `lead-response-followup-offer.md`.
- ⛔ Multi-step follow-up sequences and CRM write-back beyond the single adapter.
- ⛔ A live LLM call in production (the adapter exists; a real key + provider have
  not been configured or billed).

## 8. Staging verification status (go-live gate input)

**Status: BLOCKED — no verified staging environment exists.**

- The repository has **no dedicated staging target**. `.env.local` points at the
  hosted project `bgluypxphfutryenwtld.supabase.co`, which must be treated as
  **production**; `.env.e2e.local` points at the **local** stack
  (`http://localhost:54321`). The Supabase CLI is **not linked** to any project
  (`supabase/.temp/project-ref` absent). Vercel is linked to the `replyflow-ai`
  project (`prj_zgMXJZVoxSnMOlNHMfhqOkVTAeGi`).
- Because no target can be named conclusively, **no migration has been (or may be)
  applied to any remote/hosted database**, and no staging end-to-end run has been
  performed. Local verification only.
- ⛔ Do **not** infer a staging environment from a project name and do **not**
  apply migrations to the hosted project.

### Shortest safe path to a staging target (human-executed)

1. Create a **separate** Supabase project for staging (do not reuse the hosted
   project).
2. Add `.env.staging` with that project's URL + keys and a distinct
   `REPLYFLOW_LEAD_INTAKE_SECRET` / `REPLYFLOW_CRM_WEBHOOK_SECRET`; never commit it.
3. Link a CLI profile to the staging ref (`supabase link --project-ref <ref>`),
   keeping production linked nowhere.
4. Apply the ordered migrations from `lead-capture-migration-preflight.md` and run
   the post-migration structural + authorization-boundary verification there.
5. Point the CRM adapter at a **staging** endpoint and run one real end-to-end lead
   (capture → hold → approve → exactly-once delivery).

## Delivery readiness gap list (consolidated — one view)

Everything the pilot needs, grouped by readiness. Sources: `test:bridge`,
`demo:client-capture`, `lead-capture-service-offer.md`,
`lead-capture-migration-preflight.md`, `staging-environment-setup.md`.

**✅ Works locally and has test evidence**
- Capture + validation/normalization; malformed submissions rejected.
- Deterministic qualification (score/tier); `qualified` and `requiresApproval`.
- Durable run + append-only event timeline via the atomic transition RPC.
- Idempotency (duplicate never creates a second run).
- Human approval gate + authenticated owner/admin action; approve exactly once.
- HMAC-authenticated inbound endpoint (32 KB cap, 30/min, `503` when unset).
- Signed HTTP adapter (timeout, bounded retry, 4xx non-retry, honest failure).
- Recovery sweep excludes `approval_state='pending'`.
- Evidence: `npm run test:bridge` 365/365; `npm run demo:client-capture` exit 0.

**⚠️ Requires customer-specific configuration**
- `REPLYFLOW_LEAD_INTAKE_SECRET` set (else `503`).
- Their one inbound channel wired to `/api/automation/leads`.
- Their qualification checklist + thresholds agreed.
- A named owner/admin approver and expected response time.

**⚠️ Requires separate staging and an approved migration**
- A separate staging Supabase project + `.env.staging` (does not exist yet).
- Apply `20261005` → `20261006` → `20261007` via the preflight path, with
  explicit human approval; then run the structural + authorization probe
  (`staging-environment-setup.md` §4 and §7).

**⚠️ Requires a real CRM endpoint and credentials**
- `REPLYFLOW_CRM_WEBHOOK_URL` (absolute `https`) + `REPLYFLOW_CRM_WEBHOOK_SECRET`
  for the customer's system; a staging receiver first.
- Verify `x-replyflow-signature` (HMAC-SHA256) and the `idempotency-key` on the
  receiver; a re-POST must not double-deliver.

**⛔ Not built / excluded from the pilot**
- n8n dispatch for lead runs (runs execute synchronously).
- Outbound response automation (email/SMS/WhatsApp) and multi-step follow-up.
- Reply detection / opt-out suppression; multi-channel campaigns.
- CRM write-back beyond the single destination; a live LLM in production.
- Per-tenant intake signing keys (one shared secret per environment today).

> **Do not claim live CRM delivery** until the staging dry-run and one real
> signed delivery are verified against the customer endpoint.

## Go-live gate (all must be true)

1. All ✅ items above confirmed on the target environment.
2. Every ⚠️ either done or explicitly accepted in writing by the owner.
3. `npm run demo:client-capture` demonstrated to the client with the real adapter
   pointed at their (staging) CRM.
4. A rollback plan agreed (disable the intake secret → endpoint returns `503`).
