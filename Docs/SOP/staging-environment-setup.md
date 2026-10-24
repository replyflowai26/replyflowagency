# Staging Environment — Exact Setup Guide

> Internal engineering runbook. This document is a **procedure**, not an action.
> Do **not** create remote projects, apply remote migrations, change hosted
> settings, or reveal secrets as part of reading this. A human executes each step
> deliberately against a **named** environment. Production is the hosted project
> `bgluypxphfutryenwtld.supabase.co`; never point a staging step at it.

Status legend: ✅ already true · ⚠️ requires action · ⛔ do not do.

## 0. Why this exists

There is currently **no dedicated staging environment**. `.env.local` →
hosted project (treat as production); `.env.e2e.local` → local stack
(`http://localhost:54321`); the CLI is not linked. Because no target can be named
conclusively, nothing has been applied remotely. This guide removes that blocker
with a *separate* project.

## 1. Create the separate Supabase project

- ⚠️ Create a **new** Supabase project solely for staging (name it, e.g.,
  `replyflow-staging`). Do **not** reuse `bgluypxphfutryenwtld`.
- ⚠️ Record its **project ref** (identifier). Use a distinct ref, not the
  production ref. The local reference in `supabase/config.toml` is
  `ReplyFlow-AI-Final` and is local-only — it is not a remote staging ref.
- ⚠️ Keep the project on its own database; never link production with
  `supabase link` at the same time.
- ⛔ Do not enable any paid add-ons or point live traffic at it.

## 2. Environment file and secrets

Create a **git-ignored** `.env.staging` (never commit it). Mirrors the variable
set in `.env.example`:

Public (also exposed to the browser bundle):

- ⚠️ `NEXT_PUBLIC_SUPABASE_URL` — the staging project URL.
- ⚠️ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the staging anon/publishable key.
- ⚠️ `NEXT_PUBLIC_SITE_URL` — the staging site origin (for invite links).

Server-only (never sent to the client):

- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` — staging service-role key (server writes +
  the transition RPC as `service_role`).
- ⚠️ `REPLYFLOW_CALLBACK_SECRET` — HMAC secret for the n8n callback path.
- ⚠️ `REPLYFLOW_LEAD_INTAKE_SECRET` — HMAC secret for
  `POST /api/automation/leads` (endpoint returns `503` when unset).
- ⚠️ `REPLYFLOW_CRM_WEBHOOK_URL` + `REPLYFLOW_CRM_WEBHOOK_SECRET` — staging CRM
  endpoint + signing secret (§5).
- ⚠️ `INTERNAL_AUTOMATION_SECRET` / `CRON_SECRET` — internal cron endpoints.
- ⚠️ `N8N_BASE_URL` / `N8N_API_KEY` — only if the n8n path is exercised in
  staging (optional for the lead-capture slice, which executes synchronously).
- ⚠️ Optional: `REPLYFLOW_AI_API_KEY` / `_BASE_URL` / `_MODEL` (+ `_TIMEOUT_MS`,
  `_MAX_RETRIES`) for the Ops Assistant. With none set the deterministic planner
  is used.

- ✅ Secrets are server-only; none is exposed to the client bundle.
- ⛔ Do not reuse production secrets. Use distinct staging values.
- ⛔ Never print or commit `.env.staging`.

## 3. Migration dependency order and preconditions

Inspect the actual SQL before applying. The functions must exist before the
tightening in `20261007000000` is valid.

Prerequisites that must already be present in the staging database (part of the
base schema, applied by the earlier migrations):

- `20260815000000_company_os_foundation.sql` — creates `private.is_org_member`
  and `private.has_org_role(target_org_id, target_user_id, allowed_roles text[])`
  (granted to `authenticated`), and the org/membership tables.
- `20260816000003_automation_execution_foundation.sql` — creates
  `public.workflow_runs` + `public.workflow_run_events`, the composite foreign
  keys, and the RLS policies:
  `workflow_runs_select_member` (`is_org_member`),
  `workflow_runs_insert_member` (requested_by = uid + role),
  `workflow_runs_update_member`/`workflow_runs_delete_none`,
  `workflow_run_events_select_member`/`_insert_member`/`_delete_none`.
- `20260917000011_atomic_workflow_run_transitions.sql` — creates
  `public.apply_workflow_run_transition(...)` (SECURITY DEFINER, `search_path=''`),
  granted to `authenticated`.
- `20261004000000_grant_service_role_execute_workflow_run_transition.sql` — one
  `grant execute` to `service_role` (the callback/recovery paths run as
  `service_role`).

Apply in this strict order:

1. ⚠️ `20261005000000_workflow_run_approval_state.sql` — adds
   `workflow_runs.approval_state text not null default 'none'` + a check
   constraint + the partial `workflow_runs_pending_approval_idx`.
2. ⚠️ `20261006000000_agent_runtime_foundation.sql` — agent tables. **Only if**
   the Operations Assistant is enabled; otherwise defer.
3. ⚠️ `20261007000000_restrict_workflow_run_transition_and_approval.sql` —
   replaces the RPC body (authenticated branch now requires
   `private.has_org_role(..., array['owner','admin'])`; `service_role` stays
   trusted), adds the `workflow_runs_guard_approval_state` BEFORE UPDATE trigger,
   and re-asserts grants. **Depends on migration 1** (references
   `approval_state`).

Procedure:

```powershell
# Against the SEPARATE staging ref only. Confirm the ref before running.
supabase link --project-ref <staging-ref>
supabase migration list --linked      # confirm which are pending on staging
supabase db push                      # applies pending migrations, in order
supabase migration list --linked      # confirm staging ledger matches local
```

- ⛔ Never run `supabase db reset` against staging or production.
- ⛔ Never apply these to the hosted production project from this work.

## 4. RLS / tenant-isolation and authorization verification

Structural check (SQL editor / psql on staging):

```sql
-- 1. Column exists exactly once.
select column_name, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'workflow_runs'
   and column_name = 'approval_state';
-- expect: one row, is_nullable = NO, default 'none'

-- 2. The guard trigger exists.
select tgname from pg_trigger
 where tgrelid = 'public.workflow_runs'::regclass
   and tgname = 'workflow_runs_guard_approval_state';
-- expect: one row

-- 3. RLS is enabled and the member policies are intact (must NOT be dropped).
select polname from pg_policy
 where polrelid = 'public.workflow_runs'::regclass
 order by polname;
-- expect: workflow_runs_select_member, workflow_runs_insert_member,
--         workflow_runs_update_member, workflow_runs_delete_none

-- 4. Tenant isolation on the RPC: cross-organization must never resolve.
select public.apply_workflow_run_transition(
  '<run-id-of-org-A>'::uuid, '<org-B-id>'::uuid, 'running', 'run.dispatching');
-- expect: an exception (workflow run not found), never a written row
```

Authorization-boundary check (run the repository probe against staging with
**real signed-in users**, before enabling traffic):

- ⚠️ RPC rejects an ordinary member (`approver role required`).
- ⚠️ RPC allows an owner/admin (`applied`).
- ⚠️ RPC rejects a cross-tenant owner.
- ⚠️ RPC rejects an unauthenticated caller.
- ⚠️ RPC trusts `service_role`.
- ⚠️ Guard trigger rejects a member writing `approval_state` directly.
- ⚠️ Guard trigger allows an owner/admin to change `approval_state`.
- ⚠️ A member can still update non-approval columns (no over-blocking).

- ⛔ Do not weaken, drop or `alter` any RLS policy to make staging pass.

## 5. Dedicated staging CRM endpoint and test credentials

- ⚠️ Stand up a **staging** receiver (e.g. a request-bin style endpoint or a
  staging n8n webhook) that accepts a signed POST and returns a JSON `{ "id":
  "..." }`.
- ⚠️ Set `REPLYFLOW_CRM_WEBHOOK_URL` to that staging URL. It must be absolute
  `https` (http is accepted only for loopback). URLs embedding credentials are
  rejected by `normalizeCrmWebhookUrl`.
- ⚠️ Set a **staging-only** `REPLYFLOW_CRM_WEBHOOK_SECRET`, distinct from
  production. The adapter sends `x-replyflow-signature` (HMAC-SHA256 over the raw
  body) and a stable `idempotency-key` header; verify both on the receiver.
- ⚠️ Confirm the receiver does not log the body's PII or the secret.
- ⛔ Never point staging at the production CRM endpoint.

## 6. Rollback / recovery plan

`20261007000000` is an in-place function replace plus one additive trigger.
To revert it on staging:

```sql
drop trigger if exists workflow_runs_guard_approval_state on public.workflow_runs;
drop function if exists private.prevent_unauthorized_approval_change();
-- restore the previous (member-permissive) RPC body only if strictly required
```

`20261005000000` is additive and safe to leave in place if the feature is
switched off. Nothing drops a policy, grant or column. Operational kill-switch:
unset `REPLYFLOW_LEAD_INTAKE_SECRET` on staging → the intake endpoint returns
`503`.

## 7. Post-migration smoke test

- ⚠️ `npm run test:bridge` is green locally against the same commit.
- ⚠️ One real signed-in owner/admin resolves a hot-lead gate on staging and
  delivery occurs exactly once; a duplicate decision is refused.
- ⚠️ A cross-tenant and an unauthenticated caller are both refused.
- ⚠️ The recovery sweep (internal cron) excludes `approval_state = 'pending'`
  runs (they are never failed by the dispatch timeout).
- ⚠️ **One real signed CRM delivery:** a lead captured on staging is delivered to
  the **staging** receiver with a valid `x-replyflow-signature` (HMAC-SHA256 over
  the raw body) and a stable `idempotency-key`; the receiver confirms the
  signature and returns a JSON `{ "id": "..." }`. Re-POSTing the same payload must
  not create a second delivery. The receiver must not log the body's PII or the
  secret.
- ⚠️ A recovery sweep run leaves a held (`approval_state='pending'`) run untouched
  while failing a genuinely stuck `running` run.

## 8. Explicitly out of scope

- ⛔ Applying any migration to the hosted production project from this work.
- ⛔ Per-tenant intake signing keys (still one shared secret per environment; see
  `lead-capture-production-readiness.md` §4).
- ⛔ Switching live client traffic to staging.
- ⛔ The local E2E harness (`scripts/run-local-e2e.mjs`) is **local-only by
  design** (it refuses any non-localhost host and requires
  `REPLYFLOW_E2E_TARGET=test` / `REPLYFLOW_E2E_PROJECT_REF=localhost`). Staging
  E2E uses the signed-in-user probe above, not that harness.
