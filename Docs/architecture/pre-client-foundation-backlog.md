# ReplyFlow AI — Pre-Client Foundation Status & Master Backlog

> **SUPERSEDED (2026-10-21, task 51).** The single authoritative master is now
> [`REPLYFLOW-AI-MASTER-STATUS.md`](./REPLYFLOW-AI-MASTER-STATUS.md) (full
> 20-section company status, architecture, and gap audit). This document is
> retained unchanged as the historical record of tasks 47–50; do not update it
> further.

> Owner: CTO task 47 (pre-client foundation consolidation); task 49 (agent
> identity FK fix + authorization boundaries).
> Date: 2026-10-19. Branch: `feat/client-management-foundation`.
> This is the single master status/backlog document. It supersedes ad-hoc status
> notes; SOP documents under `Docs/SOP/` remain the sales/ops playbooks.

## Status legend

| Status | Meaning |
| --- | --- |
| `DONE-VERIFIED` | Implemented AND verified by a bounded local check in this task or a prior one (test run, code inspection of a working path). |
| `IMPLEMENTED-UNVERIFIED` | Code exists and looks complete, but runtime behaviour was not exercised against a real database/deployment in this task. |
| `PARTIAL` | A working slice exists; known gaps remain before it can serve a paying client. |
| `NOT BUILT` | No implementation exists. Marketing copy or type declarations only. |
| `BLOCKED` | Cannot progress safely without an external decision, credential, or the staging environment. |

No progress percentages are invented. Evidence class is marked for every claim:
**(V)** verified locally this task, **(P)** prior report, **(A)** assumption.

---

## 1. Executive summary (simple language)

ReplyFlow AI is an "AI operations company in a box": a Next.js platform where a
small agency captures leads, runs client automations (via n8n), and is building
an internal AI agent layer ("Jarvis") that plans tasks, uses only allowlisted
tools, and asks a human before doing anything consequential.

What genuinely works today, on local evidence: a marketing website, a
role-aware dashboard (clients, projects, workflow runs, approvals, telemetry),
a deterministic lead-capture → qualification → approval pipeline, a library of
6 workflow templates, and a fully deterministic, unit-tested agent orchestrator
(365/365 bridge tests pass locally **(V)**).

What blocks a paying client: the staging database has 20 unapplied migrations
and **no verified backup** **(P)**; every database-backed feature therefore has
the same schema version as "partially deployed" **(A)**; no live LLM,
messaging, calendar, or payment integration is configured; and the CEO has not
reviewed/locked the website design.

## 2. Current vs target company architecture

**Current (verified in code):**

- Next.js 16 App Router monolith, Supabase (auth + Postgres + RLS), no middleware;
  auth is enforced per server page/route via `supabase.auth.getClaims()` +
  membership lookups **(V)** `src/app/dashboard/**`.
- Automation core: in-process deterministic services
  (`src/lib/automation/*`) with webhook ingress (`/api/automation/leads`,
  `/api/automation/callback`), CAS-guarded state transitions, event timelines,
  recovery and retention cron endpoints **(V)**.
- Agent core: pure orchestrator + seams (`src/lib/agents/*`), one implemented
  worker (Operations Assistant), deterministic planner by default, opt-in
  OpenAI-compatible planner, unconfigured external-action adapter **(V)**.
- Template library: 6 versioned-in-code workflow templates with validation and
  execution-free instantiation planning (`src/lib/workflows/*`) **(V)**.

**Target for ≤10 clients:** the same monolith plus (a) applied migrations on a
restorable staging/production database, (b) real integration adapters behind
the existing seams (n8n, CRM webhook, email/messaging, calendar), (c) an
optional cost-capped LLM, (d) a durable task queue/worker, and (e) the Jarvis
UI + 2 chairmen / 4 managers / 10+ workers layered on the existing agent
runtime — no parallel architecture.

## 3. Website and dashboard status

| Item | Status | Evidence |
| --- | --- | --- |
| Marketing site (hero, services, workflow, trust, tech stack, CTA, footer) | `IMPLEMENTED-UNVERIFIED` | 22 modified section/component files in worktree **(V)**; extensive visual QA screenshots untracked **(V)** |
| Design LOCK | `BLOCKED` | CEO review not recorded; hard rule 9 forbids locking **(A)** |
| Dashboard shell (sidebar, topbar, breadcrumbs, error/loading states) | `DONE-VERIFIED` (code) | `src/components/dashboard/*`, `src/app/dashboard/{error,loading,global-error}.tsx` **(V)** |
| Clients CRUD + detail | `DONE-VERIFIED` (code) | `src/app/dashboard/clients/**` **(V)** |
| Projects + workflows + runs + run detail + approval controls | `DONE-VERIFIED` (code) | `src/app/dashboard/projects/**` incl. `lead-approval-controls.tsx`, `approval-actions.ts` **(V)** |
| Dashboard telemetry overview | `IMPLEMENTED-UNVERIFIED` | `getDashboardTelemetry` + KPI cards **(V)** code; depends on staging DB |
| Jarvis page | fixed in this task — see §Changes | `src/app/dashboard/jarvis/page.tsx` |
| Nav items Automations/Runs/Leads/Reports/Notifications/Settings/Help | `NOT BUILT` | disabled "Soon" chips in `navigation.ts` **(V)** |

## 4. Auth / security status

| Item | Status | Evidence |
| --- | --- | --- |
| Server-verified session (claims) + redirect to login | `DONE-VERIFIED` (code) | every dashboard page **(V)** |
| Membership roles (owner/admin/member/viewer) gating | `DONE-VERIFIED` (code) | e.g. `canInvite`, agent service role asserts **(V)** |
| RLS + membership hardening migrations | `IMPLEMENTED-UNVERIFIED` | 4 foundation/hardening migrations present, **not applied to staging (P)** |
| CSP / security headers / rate limit tests | `DONE-VERIFIED` | `csp.test.ts`, `security-headers-rate-limit.test.ts` pass **(V)** |
| Secrets handling | `DONE-VERIFIED` (code) | keys only via env; agent layers store references, never secrets **(V)** |
| Middleware-level global protection | `NOT BUILT` (by design so far) | no `middleware.ts` **(V)** — enforcement is per route; acceptable ≤10 clients but must be reviewed before scale |

## 5. Database / migration / backup status — BLOCKED

- 20 SQL migrations + 2 `.sql.backup` files exist locally in `supabase/migrations/`
  (2026-08-15 → 2026-10-07) **(V)**.
- Prior reports: 20 migrations pending on staging `emcrcloozyynbzbkbcrr`;
  **no verified staging backup**; host TCP to :5432 succeeded; container
  `pg_isready`/`pg_dump` hang **(P)**. Not retried in this task (hard rule 1/10).
- Production ref `bgluyxphfhutryewntld` must remain untouched **(P)**.
- Full blocker record: §13 and §Staging blocker.
- Consequence: every feature whose schema lives in those 20 migrations is
  `IMPLEMENTED-UNVERIFIED` at runtime — including agent tables, approval
  state, access grants, and sales pipeline **(A)**.

## 6. Lead capture and CRM readiness — PARTIAL

- Ingress: `/api/automation/leads` route + `lead-intake-core` + `lead-capture`
  with domain heuristics; demo scripts `scripts/demo-lead-capture.mjs`,
  `demo-client-capture.mjs` **(V)**.
- Orchestration: `lead-capture-run.ts`, `lead-approval-core.ts`,
  `lead-capture-service.ts` with tests (`lead-capture-workflow.test.ts`,
  `lead-approval.test.ts`) **(V)**.
- CRM: `createHttpCrmAdapter` is a real opt-in outbound webhook adapter;
  default is mock/unconfigured **(V)** `integration-adapter.ts`. No HubSpot/
  Salesforce/GoHighLevel API client exists **(A)**.
- UI: lead approval controls on the run detail page **(V)**; no dedicated
  Leads/CRM dashboard page (`/dashboard/leads` disabled) **(V)**.

## 7. Workflow library and n8n readiness — PARTIAL

- 6 templates in `WORKFLOW_TEMPLATES` (lead-capture-qualification,
  follow-up-sequence, appointment-booking, crm-synchronization,
  customer-support-routing, weekly-reporting), each with approval gates and
  credential references (vault scheme) **(V)**.
- Validation, instantiation planning, n8n id/webhook-path mapping parsers and
  dispatch core are implemented and tested (22 template/mapping tests) **(V)**.
- Gaps: template versioning is code-level only — the proposed
  `workflow_templates` DB schema is untracked SQL in
  `Docs/architecture/proposed_workflow_templates_schema.sql`, not a migration
  **(V)**; no run-history-per-template UI; n8n instance itself is external and
  unconfigured **(P/A)**.

## 8. Jarvis and AI agent readiness — PARTIAL

- Types/hierarchy (human-ceo → ai-ceo → 2 chairmen → managers → workers) are
  declared and validated as data; only the Operations Assistant worker is
  implemented **(V)** `src/lib/agents/types.ts`.
- Orchestrator: idempotency, CAS claims, retries (internal steps only),
  mid-run cancellation, durable events, approval gate, honest failure codes
  all implemented + tested (agent-ops-assistant, agent-model-adapter tests) **(V)**.
- Identity/FK safety (task 49): the orchestrator resolves the logical
  `"ops-assistant"` id to a per-organization `ai_agents` row (resolve-or-create
  on first start) before writing the uuid FK columns
  `ai_agent_tasks.agent_id` / `ai_agent_memory.agent_id` — fixing the latent
  write failure that would have hit the first task after B2 applies the
  migration **(V)** `src/lib/agents/agent-identity.ts`,
  `tests/agent-identity.test.ts` (12 tests).
- Identity lookup hardening (task 50): the resolve-or-create read now orders
  by `created_at` and applies `LIMIT 1` before `.maybeSingle()`. Confirmed
  against the installed client (`node_modules/@supabase/postgrest-js`):
  `.maybeSingle()` raises a client-side PGRST116 error when more than one row
  matches, so race-created duplicate rows would previously have made the
  organization permanently unable to start tasks — contradicting the module's
  own "converge on the first row" contract. Now duplicates converge on the
  oldest row; regression-tested **(V)**.
- Authorization boundaries (task 49): start/execute roles (owner/admin/member)
  and approval roles (owner/admin, reusing `LEAD_APPROVAL_APPROVER_ROLES` from
  `lead-approval-core.ts`) are defined once in the pure
  `src/lib/agents/authz.ts`, consumed by the service, and unit tested **(V)**.
- Model: deterministic planner default; OpenAI-compatible adapter opt-in via
  `REPLYFLOW_AI_*` env (validated, redacted, timeout+backoff, untrusted-output
  parsing) **(V)** code; never called live in this task.
- DB tables `ai_agent_tasks`, `ai_agent_task_events`, `ai_agent_memory`,
  `ai_agents`: migration prepared, **not applied** **(P)**.
- UI: honest Jarvis status page added in this task (§Changes).

## 9. Memory, task queue, approvals, reports, agent communication

| Capability | Status | Notes |
| --- | --- | --- |
| Tenant-scoped memory | `PARTIAL` | bounded key/value memory (task/agent/org scopes), no vectors/TTL/lifecycle yet **(V)** |
| Agent identity registry | `IMPLEMENTED-UNVERIFIED` | per-org resolve-or-create + race-tolerant lookup implemented and unit tested against in-memory fakes (tasks 49/50); database-backed provisioning is NOT production-ready: required migration unapplied, so FK/RLS/uuid-cast/defaults behaviour on a real database is unexercised **(V-unit)** |
| Durable task queue | `PARTIAL` | in-process execution with CAS; no background worker, no durable dispatch, no cron pickup **(V)** |
| Retries / idempotency / failure handling | `DONE-VERIFIED` (unit) | tested paths; consequential steps never auto-retried **(V)** |
| Human approvals | `PARTIAL` | axis implemented end-to-end in code + UI for lead approvals; DB column not applied **(P)** |
| Reports | `PARTIAL` | run observability + telemetry + agent `AgentTaskResult.report`; no reports page **(V)** |
| Agent ↔ agent communication | `NOT BUILT` | no messaging bus; hierarchy is data only **(V)** |

## 10. Integrations matrix

| Integration | Status | Evidence |
| --- | --- | --- |
| OpenAI-compatible LLM | `IMPLEMENTED-UNVERIFIED` | opt-in adapter **(V)** code; not configured/called |
| n8n | `PARTIAL` | dispatch/mapping core + tests **(V)**; instance unconfigured **(P)** |
| CRM (generic webhook) | `PARTIAL` | HTTP adapter opt-in **(V)**; secrets via env **(V)** |
| WhatsApp | `NOT BUILT` | marketing copy + intake options only **(V)** |
| Gmail / email send | `NOT BUILT` | copy only **(V)** |
| Google Calendar | `NOT BUILT` | copy only **(V)** |
| Stripe / Razorpay | `NOT BUILT` | copy only **(V)** |
| Slack / Telegram | `NOT BUILT` | no references in code **(V)** |

## 11. Tests, observability, deployment, documentation, recovery

- Tests: **365/365 pass** via `npm run test:bridge` (tsc bridge + node --test,
  23 suites, ~17s) **(V, this task)**. Prior 365/365 claim independently
  confirmed. Scope: pure/unit only — no staging E2E, no browser E2E in CI.
- One test file (`tests/local-e2e-callback.test.ts`) exists but is not wired
  into the bridge suite **(V)**.
- Observability: run event timelines, telemetry KPIs, structured error pages
  **(V)**; no external APM/logs pipeline **(A)**.
- Deployment: `vercel.json` + `.vercel/` present **(V)**; last successful deploy
  unknown **(P/A)**; no deploy performed (hard rule 4).
- Documentation: architecture docs (3 committed + 2 untracked) + 15 SOP docs
  untracked **(V)**; this backlog is now the master status doc.
- Recovery: `recovery-service.ts` + `/api/internal/automation/recovery` +
  retention route, secret-guarded **(V)**; untested against a real DB **(A)**.

## 12. Sales status and 10-client roadmap

- SOP playbooks exist (outreach pack, discovery script, pilot proposal,
  one-pager, lead tracker, offers) — untracked but present **(V)**.
- Product-side sales machinery (billing, contracts, client onboarding portal
  beyond intake profile) `NOT BUILT` **(V)**.
- See §10-client roadmap below for the staged plan.

## 13. Blockers (impact · dependency · safe next action)

| # | Blocker | Impact | Dependency | Safe next action |
| --- | --- | --- | --- | --- |
| B1 | No verified staging backup; `pg_dump` hangs in container **(P)** | Cannot safely apply 20 migrations; all DB-backed features half-deployed | CEO decision on backup route (host tooling vs provider snapshot) | CEO reviews options separately; no further container DB commands from CTO tasks |
| B2 | 20 staging migrations pending **(P)** | New schema (agents, approvals, grants, sales) not live anywhere | B1 | Apply only after verified backup, by explicit CEO approval |
| B3 | Website design not locked **(A)** | Blocks "production-ready" claim and outreach polish | CEO review | Present QA screenshots; await explicit LOCK |
| B4 | No real integration credentials (LLM, messaging, email, calendar, payments) | Automations can only draft, never deliver | CEO/commercial decisions per provider | Keep adapters opt-in; wire one provider at a time behind seams |
| B5 | n8n instance not provisioned/mapped **(P/A)** | Template library cannot execute externally | Server + credentials | Provision isolated n8n, map 1 template end-to-end |
| B6 | No durable background worker | Agent/workflow tasks execute only when a request triggers them | Post-migration (queue tables) | Add cron/queue worker after B2 |

## 14. Master pre-first-paying-client checklist

Ordered; each item is safe to attempt only when its dependency is met.

1. [ ] CEO: review QA screenshots, explicitly LOCK website design (B3).
2. [ ] CEO: decide staging backup route (host `pg_dump` vs Supabase dashboard
   snapshot); produce and verify one restorable backup (B1).
3. [ ] Apply the 20 migrations to staging under that backup safety net (B2) —
   explicit approval required, never in a CTO audit task.
4. [ ] Smoke-verify on staging: login, client create, project create, run a
   template with mock integrations, approve a lead, telemetry loads.
5. [ ] Promote migrations to production the same way; verify same smoke path.
   (First time production is touched — CEO-approved runbook only.)
6. [ ] Provision n8n; map `lead-capture-qualification`; run one real end-to-end
   lead through staging (B5).
7. [ ] Wire exactly one delivery integration behind the existing seam
   (recommended first: email via customer-owned SMTP/API or CRM webhook) (B4).
8. [ ] Optional: configure cost-capped LLM (`REPLYFLOW_AI_*`) behind the
   deterministic planner; verify with a 5-objective budget test.
9. [ ] Jarvis UI task-creation + approvals (after B2 applies agent tables).
10. [ ] Add durable queue worker (cron pickup of queued runs/tasks) (B6).
11. [ ] Backup/restore drill documented in `Docs/Deployment Guide/`.
12. [ ] Legal: privacy policy, DPA, terms for client data (currently absent).

## 15. Scale checklist — clients 2–10

- [ ] Per-client credential vault UX (references exist; no vault UI).
- [ ] Run-cost metering per client (tokens, n8n executions) + alerting.
- [ ] Rate limiting and quotas per tenant on ingress webhooks.
- [ ] Onboarding checklist automation from the SOP into product flows.
- [ ] Second delivery channel (WhatsApp or email) once the first is stable.
- [ ] Manager-level agents (2–4) reusing the agent runtime; chairmen only after
  managers prove value — see gap analysis.
- [ ] Observability: external error tracking + uptime checks.
- [ ] Load test with 10 simulated tenants before client #6.
- [ ] Restore drill repeated per quarter; keep verified backups per environment.

---

## Staging blocker record (frozen — do not retry in audit tasks)

- Staging ref: `emcrcloozyynbzbkbcrr`. Production ref: `bgluyxphfhutryewntld`.
- No verified staging backup exists **(P)**.
- 20 migrations remain pending on staging **(P)**.
- Windows host TCP connectivity to staging port 5432 succeeded **(P)**;
  Docker container `pg_isready`/`pg_dump` (pg_dump 17.6) attempts hang **(P)**.
- Next safe option (host-side bounded `pg_dump` vs provider snapshot) must be
  reviewed separately by the CEO. No migration, backup, secret change or
  remote database mutation was performed in task 47.

## Jarvis / agents / workflow library gap analysis (build sequence)

Reuse only; no parallel systems. Each step lists the existing anchor.

1. **Jarvis UI task loop** (needs B2 for tables): server actions calling
   `startOpsTask` / `executeOpsTask` / `decideOpsApproval` /
   `cancelOpsTask` (`src/lib/agents/ops-assistant-service.ts`) + a task list
   page reading `ai_agent_tasks` with org scoping.
2. **Durable queue**: cron route (pattern: `recovery-service.ts`) claiming
   `queued` tasks/runs; reuse CAS claim in `executeAgentTask`.
3. **Persistent memory lifecycle**: add TTL/purge policy on
   `ai_agent_memory` (migration) over `memory-core.ts` writers.
4. **Agent registry**: per-org resolve-or-create for the ops assistant is
   done (`agent-identity.ts`, task 49 — the logical id never reaches the uuid
   FK columns); extend the descriptor registry to all roles and seed them in
   the migration when B2 applies.
5. **Managers (4) then chairmen (2)**: each is a new `AgentDescriptor` +
   planner rules in `planner-core.ts` CATEGORY_STEPS — types already allow it.
   Chairmen only own routing/rollup; no new execution engine.
6. **Role/knowledge/tool permissions**: extend the allowlist model
   (`tools.ts` registry + per-agent `tools`/`knowledgeScopes` columns);
   enforce in orchestrator (already allowlist-checked) — no new framework.
7. **External adapters per capability**: implement `ExternalActionAdapter`
   for email → calendar → payments, each with idempotency keys + dry-run,
   replacing `createUnconfiguredExternalActionAdapter` one at a time.
8. **Template versioning**: promote `proposed_workflow_templates_schema.sql`
   to a real migration; add run-history read models; map n8n ids via existing
   `parseWorkflowMappingInput`.
9. **Live LLM rollout**: already safe-by-default; add per-org token budget
   counter before enabling for >1 org.
10. **Evaluation/audit/recovery**: agent task events table is the audit trail;
    add eval harness as node --test suites using the mock adapters (pattern:
    `agent-ops-assistant.test.ts`); recovery via existing CAS + recovery
    service patterns.

## Change log

- **Task 47 (2026-10-19)**: created this master backlog; implemented the honest
  Jarvis status page (`/dashboard/jarvis`); 373/373 bridge tests; build green.
- **Task 49 (2026-10-19)**: fixed the `ai_agent_tasks`/`ai_agent_memory`
  `agent_id` uuid-FK defect (logical id → per-organization `ai_agents` row via
  resolve-or-create with honest failure paths); centralized agent role
  boundaries in `src/lib/agents/authz.ts`, reusing the lead-approval approver
  roles so the two approval surfaces cannot drift; new suite
  `tests/agent-identity.test.ts` (11 tests); 384/384 bridge tests; ESLint clean
  on changed files; `next build` green; `npm run demo:ops-assistant` green.
  No staging/production DB, migration, secret, commit or outreach activity.
- **Task 50 (2026-10-21)**: re-verified Task 49's counts against fresh command
  output (pre-change run: 384 tests / 384 pass / 0 fail / 0 cancelled /
  0 skipped — Task 49's reported figure was accurate; no 374/384 figure exists
  in this document or its reports). Found and fixed one confirmed local defect:
  `ensureAgentIdentity`'s `.maybeSingle()` read fails with a client-side
  PGRST116 error when more than one `ai_agents` row matches (verified in the
  installed `@supabase/postgrest-js`), which would permanently block an
  organization after a concurrent first-start race created duplicates. The read
  now orders by `created_at` and applies `LIMIT 1`, converging on the oldest
  row; regression test added (suite now 12 tests). Fake clients in
  `tests/agent-identity.test.ts` (strict PGRST116 mimicry), 
  `tests/agent-ops-assistant.test.ts` and `scripts/demo-ops-assistant.mjs`
  gained the `order`/`limit` chain methods. Post-change results: **385/385
  bridge tests**, ESLint clean, demo green. Agent identity status recorded as
  `IMPLEMENTED-UNVERIFIED` (database-backed provisioning cannot be labelled
  production-ready while the required migration remains unapplied). No
  staging/production DB, migration, secret, commit or outreach activity.

## CTO decisions recorded in this task

1. Jarvis nav reference: keep and **enable** it, backed by an honest status
   page — removal would discard a declared architectural intent that the agent
   runtime already partially implements.
2. No fake autonomy: the page reports which capabilities are real vs planned.
3. Staging commands remain frozen; B1 escalated to the CEO.
