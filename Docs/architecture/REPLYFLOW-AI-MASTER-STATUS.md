# ReplyFlow AI — Master Company Status, Architecture & Gap Audit

> Owner: CTO task 51 (full-repo evidence audit). Date: 2026-10-21.
> Consolidated into the company operating dashboard (sections A–H, daily
> tracker, operating rule) by task 58, 2026-10-22; release gate decision
> sheet added by task 59 (§23), 2026-10-22; first-client delivery
> readiness + pilot specification added by task 61 (§24), 2026-10-22;
> Jarvis CEO reporting + notification contract added by task 62 (§25),
> 2026-10-22.
> Branch: `feat/client-management-foundation` · HEAD `646f9f5`.
> **This is the single authoritative master document.** The earlier working
> backlog (`pre-client-foundation-backlog.md`) is retained as a historical
> record and points here. Every status below carries file/test evidence or an
> explicit verification limitation. No percentages are invented; counts are
> taken from the inventory tables in each section.
>
> Status vocabulary: `DONE-VERIFIED` (implemented AND verified by a bounded
> local check) · `IMPLEMENTED-UNVERIFIED` (code complete, runtime not exercised
> against a real database/deployment) · `PARTIAL` (working slice, known gaps) ·
> `NOT BUILT` · `BLOCKED` (needs an external decision/credential/environment) ·
> `NOT APPLICABLE`. Evidence class: **(V)** verified this task, **(P)** prior
> report/record, **(A)** assumption — avoided.

---

## 1. Executive summary

ReplyFlow AI is a Next.js 16 (App Router) + Supabase application with a
marketing site, an authenticated multi-tenant dashboard (clients, projects,
runs), an automation runtime (webhook lead capture, HMAC callbacks, atomic run
state machine, recovery/retention crons), a six-template workflow library, and
the "Jarvis" agent foundation (one worker agent: task lifecycle, approval
gates, memory, model seam, per-organization identity provisioning).

What is genuinely strong, locally verified: the lead-capture → qualify →
approval-gate → delivery slice (mocked delivery), the run state machine and
its security properties (HMAC, RLS-shaped queries, rate limits, append-only
events), the agent orchestrator and identity layer (474/474
unit/local tests), a read-only CEO report, and an honest Jarvis status
surface that never claims unprovisioned capability.
What is not real yet: any live external integration (n8n instance, LLM
provider, CRM endpoint, WhatsApp/Gmail/Calendar/Stripe — none configured or
even present in code beyond adapters and template metadata), a chat interface
for Jarvis, the 16 remaining agent roles, monitoring, error tracking,
billing, and pricing. The database migration layer (21 migrations in-repo)
cannot be applied because the staging environment is blocked on a backup
decision (frozen B1), so every database-backed behaviour is
`IMPLEMENTED-UNVERIFIED` against a real database.

Business state from project records: 10 prospects researched, 1 contacted
(P-001, 2026-10-17, human-approved send, reply pending), 0 confirmed paying
clients. The claim "3 prioritized" is **not evidenced** in any project record
(see §14).

### A. Executive progress dashboard (consolidated task 58; last verification 2026-10-22)

Denominator stated explicitly: the **39 rows** of the §5 feature inventory
(no other denominator is used; no completion percentage is invented).
Verification gate for every "verified" claim: `test:bridge` **474/474**,
`lint` 0, `tsc --noEmit` 0, `next build` 0 (tasks 55–62 runs, §12).

| Bucket | Count (of 39 §5 rows) | Representative evidence |
| --- | --- | --- |
| DONE-VERIFIED (fully) | **19** | auth chain, security headers/CSP/rate limits, client mgmt, lead capture + approval gate, pilot readiness doctor, run state machine, callback ingest, n8n dispatch (mocked), 6-template workflow library, agent orchestrator, authz, Jarvis status page (§12 suites) |
| DONE-VERIFIED (unit/local) **+** IMPLEMENTED-UNVERIFIED (real DB/deployed) | **7** | agent identity, Jarvis Task Center form/list/controls (tasks 53–54), read-only CEO report (task 62), recovery/retention crons, CRM delivery — tests green (V); runtime needs B2/B5 |
| IMPLEMENTED-UNVERIFIED (only) | **3** | workspace invitations, GitHub Actions CI (never hosted-run), Vercel deployment config |
| PARTIAL | **1** | memory TTL/lifecycle (no purge policy) |
| NOT BUILT | **9** | Jarvis chat, agent hierarchy beyond 1 worker, agent→agent comms, durable background worker, workflow versioning, reports page, billing/usage, monitoring/error tracking, transactional email |
| BLOCKED (from §17 checklist; no §5 row is blocked) | **2** | staging backup (B1, frozen, CEO) + real-DB verification (B2) |

§17 checklist cross-count (16 items): **9 DONE-VERIFIED · 1
IMPLEMENTED-UNVERIFIED · 1 PARTIAL · 3 NOT BUILT/NOT STARTED · 2 BLOCKED.**
Business baseline (reported, not independently verified outcomes): **10
prospects · 1 contacted · 0 paying** (§14). CI: `IMPLEMENTED-UNVERIFIED`.
Design: **UNLOCKED** (§13). Index state: 0 staged, HEAD `646f9f5`,
branch ahead 12 of origin (V, task 62).

## 2. Verified repository state and branch

| Item | Value | Evidence |
| --- | --- | --- |
| Branch | `feat/client-management-foundation` — **ahead 12 of `origin`** (unpushed UI-era commits) | `git branch --show-current`, `git rev-list --count origin..HEAD` (V, task 57) |
| HEAD | `646f9f5 feat(ui): strengthen homepage trust and conversion` | `git log --oneline -1` (V) |
| Working tree | 110 modified/untracked status lines = 133 files (54M+79U, all prior-task work preserved, 0 staged; task-56 hygiene reduced line noise from 132 by ignoring qa-*/audit screenshot artifacts) | `git status --short`, `git diff`, `git ls-files` (V, task 62) |
| Stashes | 0 | `git stash list` (V) |
| Migrations in repo | 21 `.sql` files (+2 `.sql.backup` copies, ignored by the CLI) | `supabase/migrations/` (V) |
| CI | `.github/workflows/ci.yml` created (task 52); **not yet run on GitHub**; ⚠ the file is **untracked** (`?? .github/`) — any future commit/push must include it | workflow file (V); remote execution = limitation below |
| Lockfile | `package-lock.json` present | filesystem (V) |
| Local Supabase config | `supabase/config.toml` (`project_id = "ReplyFlow-AI-Final"`, API port 54321) | (V) |
| Vercel config | `vercel.json` with 2 crons (recovery `*/15`, retention `0 3 * * *`) | (V) — deployed-project state not verifiable from repo |

Hygiene **audited and fixed (task 56)**: `.env.example` re-included for
tracking via `!.env.example` (verified: all values empty, zero jwt/sk-shaped
strings); 28 root `qa-*` artifacts and 44 `audit/` design-review screenshots
ignored (kept on disk, never deleted); empty typo directory
`src/app/api/internal/automation/recover/` removed (0 items; real route is
`recovery/`); secret-shape scan of tracked files clean (single
package-lock integrity-hash false positive); secret-logging scan clean;
`N8N_CALLBACK_SECRET` confirmed dead — zero code references (live var is
`REPLYFLOW_CALLBACK_SECRET`) and the stale name exists only inside
`.env.local` + `.env.local.backup` (both ignored, never opened, never
modified). **Remaining for human review:** tracked root `index.html`
(0 code/config references, Next.js never serves it, 12-commit history — not
deleted); ⚠ `.github/workflows/ci.yml` and 3 `scripts/demo-*.mjs` files
referenced by package.json are **untracked** — they must be included in the
next commit session or the repo would be broken/cloned without CI; empty
business folders (`Docs/Agency Plan`, `Docs/Pricing`, `Docs/Roadmap`,
`Docs/Deployment Guide`) left as human structure.

## 3. Target company architecture

```
Human CEO ──────────────────────────────────────────────────────────────┐
│  approvals, pricing, outreach, strategy                                │
▼                                                                        │
AI CEO / Jarvis (chat + task console)                                    │
│  plans, delegates, rolls up reports                                   │
├── 2 × AI Chairmen (routing / rollup)                                   │
├── 4 × AI Managers (sales, delivery, finance, support/ops)              │
└── 10+ × AI Workers ──► approved tools & automations                    │
        │                    (lead capture, follow-up, reporting,        │
        │                     calendar, CRM sync, invoicing…)            │
        ▼                                                                │
   durable task queue + memory + event audit  ◄── human approval gates ──┘
        │
        ▼
   Supabase (RLS, tenant-scoped) · n8n (external workflows) · LLM provider
```

### Layer-by-layer: target vs actual implementation (task 58)

The diagram above is the **target**. Current reality per layer:

| Layer | Target | Actual implementation | Evidence | Missing capability | Dependency |
| --- | --- | --- | --- | --- | --- |
| Human CEO | approvals, pricing, outreach, strategy | operational **outside code** (project tracker + SOP docs) | §14 records (V); every risky action requires explicit human approval (§11) | — | none |
| Jarvis / AI CEO | chat console, planning, delegation, rollup | **status page + Task Center** (create/list/approve/reject/run) — unit-verified; **no chat, no delegation** | §5 rows; tasks 53–54 tests (V) | chat interface, delegation | real-DB runtime (B2); product build later |
| 2 × AI Chairmen | routing / rollup | **not implemented** | `AGENT_IDENTITIES` registry holds 1 worker only (V) | registry rows + routing logic | after B2 (§16 item 7) |
| 4 × AI Managers | sales/delivery/finance/ops delegation | **not implemented** | same registry evidence (V) | manager roles + task routing | after B2 |
| 10+ × AI Workers | approved tools & automations | **1 worker**: ops-assistant (planner, tool allowlist, memory, identity, authz) unit-verified; all external actions unconfigured by design | §5 rows 156–159; agent tests (V) | additional workers, configured integrations | B3 (LLM, optional), B4/B5 for real sends |
| Workflow library / n8n / approved integrations | 6 templates executed on n8n + CRM/email/messaging | library + instantiation **DONE-VERIFIED (unit)**; dispatch + CRM delivery **CODE-ONLY**; **no n8n instance, no configured integration, no LLM key** | template/dispatch tests (V); no instance in repo (V) | live instance + credentials | B4 (n8n), B5 (CRM endpoint), B3 (LLM) |
| Clients | 10 paying clients | **0 paying · 1 contacted · 10 researched** (project records — reported baseline, not independently verified outcomes) | §14 (V: records read) | sales execution | B6 pricing + outreach approval |

No layer of the target hierarchy above the single worker is operational
code; the target architecture must not be read as implemented (§4 is the
implemented view).

## 4. Current implemented architecture

```
Browser ──► Next.js 16 proxy (CSP nonce, security headers, rate-limit util)
              │
              ├── Marketing pages (/, services sections, CTA contact action)
              ├── Auth: signup / login / confirm / forgot / reset / callback
              └── Dashboard (auth-gated): Clients · Projects · Runs · Jarvis
                        │
                        ├── server actions (supabase/ssr user client, RLS)
                        └── API routes:
                            POST /api/automation/leads      (HMAC, 32KB, IP RL)
                            POST /api/automation/callback   (HMAC, idempotent)
                            POST /api/internal/automation/recovery (cron secret)
                            POST /api/internal/automation/retention (cron secret)
                        │
                        ▼
              Supabase Postgres (21 in-repo migrations; NOT applied to staging)
              service-role server paths · organization_memberships roles
                        │
              Automation core (pure, unit-tested):
              run-state-machine · atomic transition RPC · callback core ·
              n8n dispatch core (webhook URL builder + error taxonomy) ·
              lead capture/qualification · approval gates · retention RPC
                        │
              Agent foundation (pure + server wiring, unit-tested):
              ops-assistant orchestrator (idempotency, CAS, retries, events) ·
              planner + tool allowlist · model seam (deterministic default,
              OpenAI-compatible adapter opt-in, NEVER configured) ·
              memory core · agent identity (per-org resolve-or-create) ·
              authz (pure role boundaries) · external-action adapter (unconfigured)
                        │
              Jarvis page: READ-ONLY capability status probe (no chat, no task UI)
```

## 5. Feature-by-feature status inventory

| Feature | Status | Evidence / limitation |
| --- | --- | --- |
| Marketing site (homepage, sections, responsive QA) | `DONE-VERIFIED` | build green; QA screenshot artifacts at repo root incl. mobile/tablet (V); limited a11y audit passed, fixes browser-verified (task 55, §13 scope caveats apply) |
| Auth chain (signup→confirm→login→session→logout, password reset) | `DONE-VERIFIED` | `tests/local-login-harness.test.ts` + local E2E fixture suite (V); against real hosted Supabase = (P) |
| Proxy security headers + per-request CSP nonce | `DONE-VERIFIED` | `tests/security-headers-rate-limit.test.ts`, `tests/csp.test.ts` (V) |
| API rate limiting (sliding window, fail-open documented) | `DONE-VERIFIED` | security suite (V) |
| Organizations + onboarding + membership hardening | `DONE-VERIFIED` (unit/local) | `20260815*` migrations inspected (V); `create_organization` RPC; RLS policy tests (V) |
| Workspace invitations | `IMPLEMENTED-UNVERIFIED` | `src/app/dashboard/invitations/actions.ts` + `invite-member-form.tsx` build clean (V); no runtime test, no real-DB exercise |
| Client management (list/detail, pipeline statuses, outreach fields) | `DONE-VERIFIED` (unit) | `tests/client-sales-pipeline.test.ts`, `client-pipeline-validation.test.ts` (V) |
| Projects + webhook mapping UI | `DONE-VERIFIED` (unit) | mapping tests incl. duplicate-n8n-id guard (V) |
| Runs list/detail + event timeline + live polling | `DONE-VERIFIED` (unit) | `run-event-timeline`, observability, run-not-found tests (V); disambiguated embeds |
| Lead capture webhook (HMAC, size cap, rate limit, honest 503) | `DONE-VERIFIED` (local) | `tests/lead-capture-workflow.test.ts` + `demo:client-capture` (V) |
| Lead qualification + hot-lead approval gate | `DONE-VERIFIED` (local) | same suite; exactly-once delivery, race tests (V) |
| CRM delivery (signed webhook payload, honest failure when unconfigured) | `DONE-VERIFIED` (unit) + `IMPLEMENTED-UNVERIFIED` (real endpoint) | lead-capture/bridge suites incl. guarded submit (V); `REPLYFLOW_CRM_WEBHOOK_*` unset locally → honest-failure path exercised (V); no real customer endpoint (B5) |
| Pilot readiness doctor (`npm run pilot:readiness`) | `DONE-VERIFIED` (unit/local) | task 61: `tests/pilot-readiness.test.ts` 9 tests (V); presence-only env reporting (no values), CRM URL shape check, migrations never claimed applied, best verdict "STAGING VERIFICATION REQUIRED"; real output at task 61 = NOT READY locally (expected) |
| Jarvis CEO report (read-only: tasks, approvals, outcomes, pipeline, next action, data gaps) | `DONE-VERIFIED` (unit) + `IMPLEMENTED-UNVERIFIED` (real-DB read) | task 62: pure `ceo-report.ts` + 14 tests (V); server service is read-only, tenant-scoped, per-section honest "unknown"; no cost data exists → not configured; page render needs B2 for real rows |
| Run state machine + atomic transition RPC | `DONE-VERIFIED` (unit) | `automation-runtime-state`, callback-apply, transition tests (V) |
| n8n callback ingest (HMAC, idempotent, tenant-safe) | `DONE-VERIFIED` (local) | `callback-*` suites (V) |
| n8n dispatch (webhook path builder, SSRF guard, error taxonomy) | `DONE-VERIFIED` (unit, mocked HTTP) | `tests/n8n-dispatch.test.ts` (V); real n8n instance never contacted |
| Recovery + retention crons (code + vercel.json wiring) | `DONE-VERIFIED` (unit) + `IMPLEMENTED-UNVERIFIED` (deployed cron) | tests (V); deployed schedule only evidenced by `vercel.json` |
| Workflow template library (6 templates, validation, instantiation plans) | `DONE-VERIFIED` (unit) | `tests/workflow-template-library.test.ts` (V) |
| Agent task orchestrator (idempotency, CAS, retries, cancellation, events) | `DONE-VERIFIED` (unit) | `tests/agent-ops-assistant.test.ts` (V) |
| Agent identity provisioning (per-org FK-safe rows, race-tolerant) | `DONE-VERIFIED` (unit) + `IMPLEMENTED-UNVERIFIED` (real DB) | `tests/agent-identity.test.ts` 12 tests (V); migration unapplied |
| Agent authorization boundaries | `DONE-VERIFIED` (unit) | `src/lib/agents/authz.ts` + tests (V) |
| LLM model seam | `DONE-VERIFIED` (unit, injected fetch) + never configured | `tests/agent-model-adapter.test.ts` (V); no `REPLYFLOW_AI_*` in any env file (V) |
| Jarvis dashboard page (honest status) | `DONE-VERIFIED` | route in build (V); `tests/jarvis-status.test.ts` (V) |
| Jarvis chat interface | `NOT BUILT` | page has no input/chat component (V) `src/app/dashboard/jarvis/page.tsx` |
| Jarvis Task Center: creation form (title, objective, priority), server action, honest outcome states | `DONE-VERIFIED` (unit) + `IMPLEMENTED-UNVERIFIED` (real-DB runtime) | task 53: `tests/jarvis-task-center.test.ts` 29 tests (V); form disabled unless a probe confirms the runtime tables (V) |
| Jarvis Task Center: task list + true empty state + migration-blocker state | `DONE-VERIFIED` (unit) + `IMPLEMENTED-UNVERIFIED` (real-DB runtime) | new `listAgentTasks`/`listOpsTasks` + tests (V); empty state only shown when persistence confirmed (V) |
| Jarvis Task Center: Approve & run / Reject controls (owner/admin, pending tasks) + explicit Run task (writer, queued, gate satisfied) | `DONE-VERIFIED` (unit) + `IMPLEMENTED-UNVERIFIED` (real-DB runtime) | task 54: `tests/jarvis-task-controls.test.ts` 30 tests (V); eligibility helpers + CAS-lost = info not success (V); persistence-gated like the form (V) |
| Agent hierarchy beyond 1 worker | `NOT BUILT` | `AGENT_IDENTITIES` registry contains only ops-assistant (V) |
| Agent→agent communication / delegation | `NOT BUILT` | no messaging bus anywhere in `src/lib/agents` (V) |
| Durable background worker for agent tasks | `NOT BUILT` | in-process execution only (V) `ops-assistant.ts` |
| Memory TTL/lifecycle | `PARTIAL` | bounded scoped memory, no purge policy (V) `memory-core.ts` |
| Workflow versioning / run history read models | `NOT BUILT` | catalog is static; no versions table |
| Reports page | `NOT BUILT` | nav entry disabled (V) |
| Billing / subscriptions / usage limits | `NOT BUILT` | no code, no dependency |
| Monitoring / error tracking / analytics | `NOT BUILT` | no Sentry/PostHog/GA dep or code (V); `lib/telemetry/logging.ts` is a small logger only |
| Email delivery (transactional) | `NOT BUILT` | no provider dep or code (V) |
| CI (GitHub Actions) | `IMPLEMENTED-UNVERIFIED` | `.github/workflows/ci.yml` (V); workflow syntax/structure validated locally (V); **has not run on GitHub** |
| Deployment to Vercel (configured) | `IMPLEMENTED-UNVERIFIED` | `vercel.json`, `.vercel` dir present (V); live deployment not verified from repo |

## 6. Jarvis capability matrix

| Capability | Implemented | Configured here | Notes |
| --- | --- | --- | --- |
| Status page with capability probe | yes | yes | honest states: available / not configured / needs attention / not provisioned (V) |
| Chat interface | no | — | not built |
| Task planning (deterministic) | yes | yes (default) | planner-core, allowlisted tools (V) |
| LLM planning | adapter code only | **no key/base/model set in any env file** (V) | partial config fails honestly |
| Tool execution (internal) | yes | yes | deterministic executor (V) |
| External actions (email send etc.) | adapter seam only | **unconfigured by default** | returns `EXTERNAL_ACTION_UNCONFIGURED` (V) |
| Human approval gates | yes | yes | owner/admin only; reuses lead-approval roles; every decision event records `decided_by_user_id` (task 60) (V) |
| Durable task persistence | code ready | **DB migration unapplied** | `IMPLEMENTED-UNVERIFIED` |
| Task creation UI (validated form → server action → `startOpsTask`) | yes (task 53) | enabled only when a probe confirms the runtime tables | honest outcome states; never claims execution (V) |
| Task list UI (status/priority/approval badges, timestamps) | yes (task 53) | same probe gate | true empty state only when persistence confirmed (V) |
| Approval/execute controls in the UI | yes (task 54) | `canShowApprovalControls`/`canShowRunControl` mirror the server boundaries | Approve & run (approve executes synchronously), Reject (cancels), explicit Run; CAS-lost races read as "nothing changed" (V) |
| Self-approval prohibition | **no — policy gap, documented** | lead-approval-core defines a role boundary only | deliberately not invented in task 54; needs a CEO/product decision if required |
| Memory (scoped, bounded) | yes | code-level | no vectors/TTL |
| Event audit trail | yes (append-only + trigger) | code-level | migration defines append-only trigger (V); approval decision events on both surfaces (lead + agent) now carry the acting approver's user id, payload-only, no schema change (task 60, V) |
| Read-only CEO report (task progress, pending approvals, recent outcomes/errors, client pipeline, next action, data gaps) | yes (task 62) | yes, any workspace member with a session; tenant + RLS scoped | `ceo-report.ts` pure assembly + `ceo-report-service.ts` read-only queries (V); unavailable sources labelled unknown, never zero; AI cost never estimated (V) |
| Email / WhatsApp / phone notifications | **no — contract only** | **no provider, no credentials, no send path** | `notification-providers.ts` defines the request shape, validation, limits and required guarantees; every channel reports `not-built` (task 62, V) |
| Multi-agent coordination | no | — | types allow it; nothing implements it |
| Autonomy | deliberately none | — | consequential steps always gated (V) |

Next Jarvis step: the Task Center (create + list + approve/reject/run) is
built (tasks 53–54), and a read-only CEO report now summarizes tasks,
pending approvals, recent workflow outcomes, client pipeline and the next
recommended action on the same dashboard (task 62, §25). Runtime
verification of everything database-backed still waits on B2. Remaining
Jarvis gaps: chat interface, background worker, multi-agent hierarchy,
memory lifecycle, and notification delivery (§5).

## 7. Agent hierarchy and worker capability matrix

Target: Human CEO → AI CEO → 2 Chairmen → 4 Managers → 10+ Workers.

| Layer | Status | Evidence |
| --- | --- | --- |
| Role vocabulary + reports-to rules | `DONE-VERIFIED` (unit) | `types.ts` + role-hierarchy test (V) |
| Registry / descriptors | `PARTIAL` | 1 entry (`OPS_ASSISTANT_IDENTITY`) (V) |
| Identity provisioning (per-org rows) | `DONE-VERIFIED` (unit), `IMPLEMENTED-UNVERIFIED` (DB) | `agent-identity.ts`, 12 tests (V) |
| Task lifecycle (queued→running→succeeded/failed/cancelled) | `DONE-VERIFIED` (unit) | CAS claims, retries, cancellation tests (V) |
| Priorities | `PARTIAL` | stored and validated; no scheduler uses them yet (V) |
| Dependencies between tasks | `NOT BUILT` | — |
| Approval gates + escalation | `DONE-VERIFIED` (unit) | approve/reject/double-decision tests (V) |
| Memory scopes (task/agent/org) | `DONE-VERIFIED` (unit) | bounded; no lifecycle (V) |
| Audit/events | `DONE-VERIFIED` (unit + migration design) | append-only trigger (V) |
| Chairmen/Managers/extra Workers | `NOT BUILT` | — |

Worker capability (Operations Assistant only): research · reporting ·
data-summary · drafting · scheduling composition · finance/production drafts —
consequential categories (outreach send, payments, production changes) always
stop at a human approval gate. Never sends, never deploys, never pays (V).

## 8. Workflow/automation library matrix

| Template | Validation | Local execution | Real execution |
| --- | --- | --- | --- |
| lead-capture-qualification | `DONE-VERIFIED` | `DONE-VERIFIED` (synchronous orchestrator, demo green) | CRM delivery needs `REPLYFLOW_CRM_WEBHOOK_URL/_SECRET` — unconfigured |
| follow-up-sequence | `DONE-VERIFIED` | `NOT BUILT` (needs messaging provider + scheduler) | gated: messaging credential reference is template metadata only |
| appointment-booking | `DONE-VERIFIED` | `NOT BUILT` (calendar provider absent) | metadata only |
| crm-synchronization | `DONE-VERIFIED` | `NOT BUILT` | metadata only |
| customer-support-routing | `DONE-VERIFIED` | `NOT BUILT` | metadata only |
| weekly-reporting | `DONE-VERIFIED` | `NOT BUILT` (aggregate step not implemented) | metadata only |

Schema story: a *proposed* templates schema exists as documentation-only SQL
(`Docs/architecture/proposed_workflow_templates_schema.sql`) — not a migration,
never applied. n8n mapping is per-workflow rows via the tested
`updateWorkflowMapping` action; execution history lives in `workflow_runs` +
append-only events; retries: lead-capture path is synchronous with honest
failure; n8n-dispatch retries 5xx/network with taxonomy; recovery reconciles
ambiguous dispatches; retention purge is RPC + cron (all unit-verified).

## 9. Integration matrix

| Integration | Classification | Evidence |
| --- | --- | --- |
| OpenAI-compatible LLM | 3 — code implemented, unconfigured | adapter + tests (V); `REPLYFLOW_AI_API_KEY/BASE_URL/MODEL` names documented; absent from env files (V) |
| n8n | 3 — dispatch/recovery code implemented; instance unconfigured | `n8n-dispatch-core.ts` + tests (V); `N8N_BASE_URL/N8N_API_KEY` names only |
| Generic CRM webhook (HMAC HTTP) | 3 — implemented, unconfigured; verified against mock | HTTP adapter retry/abort tests (V) |
| WhatsApp Cloud API | 2 — template metadata only | enum value in `catalog.ts` (V) |
| Gmail API | 1 — not present | only "gmail.com" consumer-blocklist string (V) |
| Google Calendar | 2 — template metadata only | `provider: "calendar"` in catalog (V) |
| Stripe | 1 — not present | no dep/code (V) |
| Razorpay | 1 — not present | no dep/code (V) |
| Telegram / Slack | 1 — not present | no dep/code (V) |
| Named CRM providers (HubSpot etc.) | 1 — not present | only the generic webhook adapter |
| Email delivery | 1 — not present | no provider dep |
| Analytics (GA/PostHog) | 1 — not present | — |
| Logging | 3 — small structured logger | `src/lib/telemetry/logging.ts` (V) |
| Error tracking (Sentry etc.) | 1 — not present | — |
| Notifications (email/Slack push) | 1 — in-dashboard only | run timeline + approval controls |
| Billing / subscriptions / usage limits | 1 — not present | — |

## 10. Tools, libraries, extensions, and CI inventory

### Tool / API inventory (canonical, task 58)

Status vocabulary: `USED` (exercised and verified in this repo) ·
`CODE-ONLY` (integration code exists, nothing configured) ·
`CONFIGURED-UNVERIFIED` (configuration present, remote/runtime state never
observed) · `VERIFIED-INTEGRATION` (live external call proven — **no tool
qualifies yet**) · `MISSING` (no code, no config) · `NOT-VERIFIABLE`
(machine/remote state not inspectable from the repository). Credential
**names only — never values**. Cost: free/current-stack · usage-billed ·
paid/unknown.

| Tool | Purpose | Status | Evidence / path | Credential names (no values) | Cost | Requirement | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Next.js 16 | app framework (App Router, proxy) | USED | `next.config.ts`; build = 21 routes + proxy, exit 0 (V) | — | free/current-stack | required | none |
| React 19 | UI runtime | USED | imports across `src/` (V) | — | free/current-stack | required | none |
| TypeScript 5.8 | type safety | USED | `tsc --noEmit` exit 0 (V) | — | free/current-stack | required | none |
| Tailwind 4 + PostCSS | styling / design system | USED | `src/app/globals.css`, `postcss.config.mjs` (V) | — | free/current-stack | required | none |
| Supabase (supabase-js + SSR, local stack) | auth, Postgres, RLS | CONFIGURED-UNVERIFIED (hosted) · USED (local harness) | `supabase/config.toml`; local E2E fixtures (V); real-DB paths `IMPLEMENTED-UNVERIFIED` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | usage-billed (free tier likely) | required before first client | B1 → B2 staging verification |
| n8n | visual workflow execution | CODE-ONLY | `tests/n8n-dispatch.test.ts` (V, mocked HTTP); no instance/compose file in repo (V) | `N8N_BASE_URL`, `N8N_API_KEY` | free self-host / paid cloud | required for scaling (not pilot) | CEO supplies instance (B4) |
| OpenAI-compatible LLM | agent reasoning | CODE-ONLY (deterministic planner is the default; adapter never configured) | `src/lib/agents/model-provider-openai.ts` + adapter tests (V); no `REPLYFLOW_AI_*` in any env file (V) | `REPLYFLOW_AI_API_KEY`, `REPLYFLOW_AI_BASE_URL`, `REPLYFLOW_AI_MODEL`, `REPLYFLOW_AI_TIMEOUT_MS`, `REPLYFLOW_AI_MAX_RETRIES` | usage-billed | optional (planner works without) | CEO opts in (B3) |
| Git | version control | USED | local history at `646f9f5` (V) | — | free/current-stack | required | none |
| GitHub (remote) | hosting, PRs | CONFIGURED-UNVERIFIED | `origin` exists; branch **ahead 12** — nothing pushed from tasks 51–62 (V) | machine auth (not inspectable) | free | required before first client | Task 63: CEO-authorized push |
| GitHub Actions | CI | CONFIGURED-UNVERIFIED (**file itself untracked**; never hosted-run) | `.github/workflows/ci.yml` (V); YAML validated locally (V) | none — workflow uses no secrets (V) | free tier | required before first client | commit + push, then observe run (§16 item 4) |
| Playwright (via MCP tool) | browser QA / a11y audits | USED (MCP, not an npm dep) | `.playwright-mcp/` artifacts; task-55 audit (V) | — | free/current-stack | re-verify before launch | re-run pre-launch pass |
| Gmail | transactional/outbound email | MISSING | no adapter or template code (V: §9 matrix) | none in repo | usage-billed (API free tier) | required only if email is the pilot channel | CEO chooses pilot channel |
| WhatsApp | messaging channel | MISSING (name appears in template metadata only) | §9 matrix (V) | none in repo | paid per message | required only if WhatsApp is the pilot channel | CEO channel decision + provider creds |
| Google Calendar | scheduling | MISSING | §9 matrix (V) | none in repo | paid/API | optional | later stage |
| CRM webhook (customer-owned endpoint) | lead delivery for the pilot | CODE-ONLY (payload builder + HMAC signature + honest failure) | lead-capture/guarded-submit suites (V) | `REPLYFLOW_CRM_WEBHOOK_URL`, `REPLYFLOW_CRM_WEBHOOK_SECRET` | free (client-owned endpoint) | required before first client | B5 (client supplies endpoint) |
| Stripe / Razorpay | billing | MISSING (no dependency, no code) | `package.json` (V) | none | paid/unknown | required for scaling (Stage 5+) | after pricing decision B6 |
| Telegram / Slack | push notifications | MISSING (no dependency, no code) | `package.json` (V) | none | free/paid options | optional | later |
| In-repo logger | runtime logging | USED | `src/lib/telemetry/logging.ts` (V) | — | free/current-stack | required | none |
| Error tracking (Sentry-class) | error alerting | MISSING (no dependency, no code) | `package.json` (V) | none yet | free tier | **required before first client run is live** | CEO creates account (§16 item 5) |
| Vercel | hosting + crons | CONFIGURED-UNVERIFIED | `vercel.json` (2 crons), `.vercel/` dir (V); live project not observable | env set in dashboard only (names = server env set, B7) | paid/unknown (free tier likely) | required for production | B7 env + cron audit |
| Editor extensions (VS Code / OpenCode) | dev experience | NOT-VERIFIABLE (machine state not inspectable from repo) | only MCP server config is evidenced: `opencode.json` + `.vscode/mcp.json` (both gitignored) (V) | — | free | optional | none — **not claimed installed** |

`VERIFIED-INTEGRATION` count: **0** — no live external service has been
exercised from this repository (B1–B7 stand).

### Installed and used (narrative)
`next@16`, `react@19`, `react-dom@19`, `@supabase/supabase-js@2`,
`@supabase/ssr@0.12`, `motion@12`; dev: `typescript@5.8`, `eslint@9` +
`eslint-config-next`, `tailwindcss@4` + postcss plugin, `@types/*`.

**Installed but unused/questionable:** none found (every dependency is
imported). Stray root files are artifacts, not dependencies.

**Developer tooling evidenced by the repo:**
- Supabase local stack: `supabase/config.toml`, `supabase init` layout,
  `.branches/.temp` dirs (V). CLI itself: not verifiable from repository.
- Custom local harnesses (all in `scripts/`, all tested): `run-local-dev.mjs`
  (env-gated launcher), `run-local-e2e.mjs`, `run-local-login-smoke.mjs`,
  `repair-local-auth-nulls.mjs`, three in-memory demos, and the read-only
  `pilot-readiness.mjs` report (task 61).
- Playwright MCP: configured in `opencode.json` + `.vscode/mcp.json` (msedge,
  local origins only) (V); 165 artifacts in `.playwright-mcp/`. The Playwright
  npm package is not a project dependency — browser automation runs via the
  MCP tool, not CI.
- n8n local tooling: none in repo (no docker-compose, no n8n package).

**CI/CD status (updated task 52):**
- Workflow: **`.github/workflows/ci.yml`** — free-tier GitHub Actions, created
  2026-10-21 (V: file written + locally validated).
- Triggers: push to `feat/client-management-foundation`, pull requests
  targeting it, manual `workflow_dispatch`.
- Checks configured (in order): `npm ci` → `npm run test:bridge` →
  `npm run lint` → `npx tsc --noEmit -p tsconfig.json` → `npm run build`.
- Controls: Node `24.15.0` (exact local runtime version), npm cache,
  20-minute job timeout, `concurrency` with `cancel-in-progress` per ref,
  `permissions: contents: read` only, no secrets, no artifacts, no deploy.
- Executed locally, all green (V): `test:bridge` **444/444** (exit 0, re-run
  at task 54; was 414/414 at task 53, 385/385 at task 52),
  `lint` exit 0, full `tsc --noEmit -p tsconfig.json` exit 0, `next build`
  exit 0 — including a **CI-equivalent build with every local env file
  removed** (`.env.local` temporarily renamed, then restored; build still
  exit 0), proving the workflow needs no build-time credentials.
- **Not executed:** `npm ci` and the GitHub-hosted run itself — a GitHub
  runner must execute the workflow before it can be called passing. Until
  then CI is `IMPLEMENTED-UNVERIFIED`. Workflow YAML parsed with `js-yaml`
  plus structural assertions (triggers/permissions/steps/timeout) (V).
- Deployment config (separate, unchanged): `vercel.json` (2 crons) +
  `.vercel` dir; live project state not verifiable.

**Testing/type/lint/build:** `npm run test:bridge` (27 files, `tsc` +
`node --test`), `npm run lint`, `next build` — all green this task (§12).

**Extensions:** VS Code/OpenCode *extension list* is not verifiable from the
repository; only the MCP server configuration above is.

**Still needed (priority-ordered, free-first):**
1. CI *proven green on GitHub* — workflow exists (task 52); first remote run
   must be observed and recorded here (free tier).
2. Error tracking (Sentry free tier) — **required before first client run is
   live**; until then failures are only visible via run events.
3. Uptime/status check (free tier) — useful later.
4. n8n instance (self-hosted docker or cloud) — **required before any n8n-executed
   client workflow**; not required for the synchronous lead-capture pilot.
5. Transactional email (Resend/Postmark free tier) — required before client
   notifications leave the dashboard.
6. Redundant/unnecessary: no monorepo tools, no extra test frameworks (node:test
   suffices), no CSS-in-JS (Tailwind covers it).

## 11. Security and database/migration status

- **AuthN/Z:** server-only modules (`import "server-only"`), service-role key
  used only in admin client (`src/lib/supabase/admin.ts`); user-scoped SSR
  client everywhere else; role gates (owner/admin/member/viewer) enforced in
  server actions with source-inspection tests (V).
- **Tenant isolation:** every query path filters `organization_id` derived from
  the session membership, never from the browser (V: multiple suites).
- **APIs:** HMAC-SHA256 signatures on callback + lead intake (timing-safe
  compare, raw-body binding), 32 KB cap, IP rate limits, cron secrets,
  honest 503 when secrets unset (V).
- **CSP:** per-request nonce, no unsafe-inline/eval, proxy-applied (V).
- **Secrets hygiene:** `.env.example` documents 16 names with no values;
  no `NEXT_PUBLIC_` exposure of secrets; adapter never logs the AI key (V);
  `.env.local.backup` exists at root (hygiene risk, values not inspected).
- **Migrations:** 21 additive migrations in-repo, RLS on every table,
  append-only triggers, membership hardening. Applied state:
  **staging has 20 pending migrations and no verified backup — BLOCKED (frozen
  B1)** (P: task 47 audit; not re-attempted per hard rule). Production ref
  untouched. No migration was created/edited/applied in tasks 47–53.
- **Backups/PITR:** no evidence available from the repository — BLOCKED on
  the same CEO decision.

### Release-readiness checklist (consolidated task 58)

| Item | Status | Evidence / blocker |
| --- | --- | --- |
| Staging backup decision | **BLOCKED (B1, frozen)** | CEO decision pending; never re-attempted in tasks 47–62 (V: no DB command in any task log) |
| Migration readiness | code-ready, **not applied** | 17 tracked + 3 untracked additive SQL files; 0 destructive patterns (V, task 57 audit); application requires B1→B2 |
| RLS / auth E2E | local fixture suite green (V); against staging/production **BLOCKED (B2)** | `tests/local-e2e-*`, RLS policy suites (V) |
| Secret hygiene | **verified clean (tasks 56–57)** | `.env.local*` ignored + never opened; `.env.example` placeholder-only; diff secret-shape scan 0 hits (V) |
| CI hosted-run status | `IMPLEMENTED-UNVERIFIED` | workflow never executed on GitHub; ci.yml untracked until Task 63 push (trigger on push to this branch, permissions `contents: read`, no `secrets.*` references — inspected task 59) |
| Deployment readiness | config present, live state `NOT-VERIFIABLE` from repo | `vercel.json` + `.vercel/` (V); no deploy performed (B7) |
| Human approval for risky actions | **mandatory** | staging/migrations/credential changes/commits+pushes/deploys/outreach/pricing/design-`LOCK` all require explicit human approval; agent-side consequential runs gated owner/admin (tasks 54 tests, V) |

## 12. Test/build/lint/type-check evidence (tasks 52–62 runs, actual output)

| Command | Result |
| --- | --- |
| `npm run test:bridge` | **tests 474 · pass 474 · fail 0 · cancelled 0 · skipped 0 · todo 0 · exit 0** (29 test files; ~15 s) (V, tasks 55–62 — was 460 at task 61, 451 at task 60, 444 at tasks 55–59; +14 CEO-report/notification tests at task 62) |
| Focused `node --test .test-dist/tests/jarvis-task-controls.test.js` | **30/30 pass, exit 0** (V, task 54, run before the full suite) |
| `npm run lint` | exit 0, no findings (V, tasks 55–62) |
| `npx tsc --noEmit -p tsconfig.json` (full project) | exit 0 (V, tasks 55–62) |
| `npx tsc -p tsconfig.bridge-test.json` | exit 0 (part of test:bridge) |
| `npm run build` (normal, `.env.local` present) | exit 0; 21 routes + proxy; all dynamic (V, tasks 55–62) |
| `npm run pilot:readiness` | exit 0; real local run: 1 present · 7 missing · 0 invalid · 5 unverified · verdict **NOT READY** (expected: no credentials in an audit task) (V, task 61) |
| `npm run build` **without any env file** (CI-equivalence: `.env.local` renamed away, build ran, then restored — `RESTORED=True STRAY=False`) | exit 0 — no build-time credentials required (V, task 52) |
| Workflow YAML parsed (`js-yaml` + structural assertions) | OK — triggers, least-privilege permissions, concurrency, timeout, exact step order all asserted (V, task 52) |
| `npm run demo:ops-assistant` (Task 50) | green: 3 tasks, 13 events, 6 memory, 1 mock external action |
| **GitHub-hosted `npm ci` + full workflow run** | **NOT EXECUTED** — no GitHub runner has run `.github/workflows/ci.yml` yet; do not claim CI passing (inspected task 59: triggers `push`/`pull_request` on this branch + `workflow_dispatch`; `permissions: contents: read`; zero `secrets.*` references; Node 24.15.0 matches local; 20-min timeout; concurrency cancel-in-progress) |

**Task 54 file manifest (exact):** created
`src/app/dashboard/jarvis/task-actions.tsx`,
`tests/jarvis-task-controls.test.ts`; modified
`src/lib/agents/task-center.ts` (approval/run outcome mappers, eligibility
helpers, control messages),
`src/app/dashboard/jarvis/actions.ts` (shared guard + approve/reject/run
actions),
`src/app/dashboard/jarvis/page.tsx` (per-row controls wiring),
`tsconfig.bridge-test.json` + `package.json` (test wiring). All additive;
no orchestrator/service/authorization code was changed.

**Task 55 file manifest (exact):** modified
`src/components/lamp-login.tsx` (password label restructure: `htmlFor`
sibling, "Forgot password?" Link moved outside the label; fabricated status
panel → honest "Workspace scope / In preview" copy, fake 82% progress bar
removed; opacity-tier contrast raises),
`src/sections/footer.tsx` ("Systems operational" emerald claim → "Built on
ReplyFlow OS" blue + nav links to 36 px `inline-block py-2` targets),
`src/components/navbar.tsx` (`<nav aria-label="Primary">`),
`src/sections/problem-opportunity.tsx`, `src/sections/why-replyflow.tsx`,
`src/sections/process.tsx`, `src/sections/cta.tsx` (homepage contrast:
paper/30–/40 → /65, ink-soft/60 → ink-soft, blue-300/50 → /85),
`src/components/dashboard/sidebar.tsx` (4 low-opacity text tiers → /60;
disabled row + badge intentionally left low — WCAG disabled exemption),
plus a scripted tier sweep `text-white/(20|25|30|35|40|45)` → `text-white/60`
applied to **38 files / 166 replacements** (auth pages, dashboard pages,
jarvis pages, shared components, marketing sections — sweep excluded
`sidebar.tsx`; no test asserts these classes (grep-verified)). No markup,
logic, API, migration, or package changes.

**Task 55 browser evidence (Playwright MCP, local dev server, one page per
run):** all contrast scans use canvas-pixel color readback (computed
`oklab()` serializations defeat string parsing), alpha blending over the
first opaque ancestor bg, 4.5:1 (3:1 large text) thresholds, `aria-hidden`
subtrees skipped. Final state: `/` 0 failures (was 9), `/login` 0 (was 8),
`/signup` 0, `/forgot-password` 0, `/does-not-exist` 404 0; console errors 0
on all pages (the only logged error is the deliberate 404 status itself for
a bogus URL); `/login` accessible password name exactly "Password",
`nestedLink=false`; footer links 36 px; `aria-label` "Primary" present;
footer reads "Built on ReplyFlow OS"; `/dashboard` unauthenticated →
redirects to `/login`; mobile 375 px: no horizontal scroll, mobile menu
toggles `aria-expanded` + Open/Close label + Escape-to-close; focus ring
2 px solid on all tabbed controls; contact form wired to real server action
`submitContactLead`. Auth-guarded dashboard pages: contrast fixes are
**source-only** (no local credentials to log in) — verified by build/type
only, not browser.

Test taxonomy: the 444 are **unit/local** tests using in-memory fakes and
mocked HTTP — they do NOT prove real-database, real-n8n, real-LLM or deployed
behaviour. Local E2E (login smoke, callback fixture) runs against a local
Supabase container when present. Staging E2E: blocked. Real-client tests:
none (0 clients).

**Task 56 hygiene manifest (exact):** modified `.gitignore` (added
`!.env.example` exception directly after `.env*`; appended root-anchored
`/qa-*.png`, `/qa-*.yml`, `/qa-*.txt` and `/audit/` rules for local
screenshot evidence); deleted empty typo directory
`src/app/api/internal/automation/recover/` (verified 0 items before
removal; sibling `recovery/route.ts` is the real route). Nothing else was
created, moved, or modified — no source/config/script content changed, no
env file opened or edited, no file staged. `.env.example` is now visible as
an untracked file ready to be included in the next commit (contents
verified placeholder-only: every value empty, 0 jwt/sk-shaped strings, 0
N8N_CALLBACK_SECRET).

**Task 57 change-review inventory (verified; Git index untouched):**
worktree = 54 modified files (1423+/858−) + 71 untracked files + **0
staged**; full-diff secret-shape scan: 0 hits; `.env.local*` still ignored
and unstaged. Proposed CEO commit groups (exact membership in the task-57
report; no file may appear in two groups without content edits, which were
forbidden): **G1** marketing site design + a11y (~24 files) · **G2**
dashboard UI + a11y + Jarvis nav (~20) · **G3** lead-capture + approval
runtime incl. observability and approval UI (~14) · **G4** agent foundation
+ Jarvis Task Center (19) · **G5** workflow library (5) · **G6** tests,
bridge-test wiring, demo scripts (15) · **G7** CI workflow + `.gitignore`
hygiene + `.env.example` (3) · **G8** documentation (21) · **M** the 3
untracked migrations, staged **never** inside code commits — separate,
CEO/DB-approved item only; runtime code degrades gracefully when
`approval_state` is absent (42703 fallback in `run-observability.ts`), so
code may land before the migrations are ever applied. Migration audit
result: all 3 untracked SQL files are additive (create-table-if-not-exists /
create-or-replace / indexes / RLS / append-only guards), **0 destructive
patterns**, dependency order 20261005 → 20261007 with 20261006
independent; none applied anywhere (B1 frozen). Verification re-run:
444/444 pass, exit 0.

**Task 60 change manifest (exact; Git index untouched):** the selected
improvement was **approver actor attribution on both human-approval
surfaces** (lead-capture + Jarvis agent), chosen over the runner-up
(pilot-readiness doctor script) because it closes the only remaining
unblocked audit-trail gap serving both Jarvis question 1
("approve/report safely") and question 5 (observable approvals/audit)
without B1/B2/B5/B6. Modified (4 production + 2 test files):
`src/lib/automation/lead-capture-run.ts` (`LeadCaptureContext` gains
optional `decidedByUserId`; `approvalGranted` and rejection-`cancelled`
event payloads record `decided_by_user_id`, `null` when absent),
`src/app/dashboard/projects/[id]/runs/[runId]/approval-actions.ts`
(threads session-derived `actor.userId` — never client-supplied),
`src/lib/agents/ops-assistant.ts` (`OpsAssistantContext` gains optional
`actorUserId`; approval-rejected/cancelled/granted events record
`decided_by_user_id`), `src/lib/agents/ops-assistant-service.ts`
(`buildContext` sets `actorUserId` from the session user),
`tests/lead-approval.test.ts` (+4 tests: approve/reject attribution,
null-back-compat with key-present, action source-inspection),
`tests/agent-ops-assistant.test.ts` (+3 tests: approve/reject
attribution, null-back-compat, service wiring source-inspection).
Payload-only — **no schema change, no migration, no PII** (user id, not
lead data); all pre-task-60 call sites (tests, 3 demo scripts) remain
valid unchanged because both context fields are optional. Quality gate
re-run at task 60: **451/451 pass, exit 0; lint 0; tsc 0; build 0.**
Hosted CI still never run. Self-approval prohibition remains a CEO
policy gap (decision 15) — attribution now makes any future rule
enforceable and auditable.

**Task 61 change manifest (exact; Git index untouched):** the selected
improvement was the **first-client pilot readiness doctor** — the runner-up
from task 60 — because it converts the scattered go-live checklist into one
repeatable, value-free evidence command usable before every client
conversation. New (3): `src/lib/operations/pilot-readiness.ts` (pure module:
presence-only env checks, CRM URL shape validation reusing
`normalizeCrmWebhookUrl`, migration-file presence, honest verdicts),
`scripts/pilot-readiness.mjs` (CLI; reads `process.env` presence and file
existence only, never opens env files, never prints values, exit 0 =
report not gate), `tests/pilot-readiness.test.ts` (+9 tests incl. a
no-value-leak serialization assertion and a wiring check). Modified (2):
`package.json` (`pilot:readiness` script + test:bridge entry),
`tsconfig.bridge-test.json` (new module + test). No change to the
lead-capture runtime: task 61 **validated, not rebuilt**, the delivery
flow (§24). Quality gate at task 61: **460/460 pass, exit 0; lint 0;
tsc 0; build 0.** CLI real output: NOT READY locally (no credentials —
correct and expected). Hosted CI still never run; B1/B2/B5/B6 unchanged.

**Task 62 change manifest (exact; Git index untouched):** the selected
improvement was the **read-only Jarvis CEO report**, because it converts
data that already exists (task status, approval gates, run outcomes,
client rows) into one board-level view without adding a queue, a provider
or a write path. New (5): `src/lib/agents/ceo-report.ts` (pure assembly +
deterministic next-action priority + honest data gaps),
`src/lib/agents/ceo-report-service.ts` (server-only, read-only,
tenant-scoped queries: per-status task counts, both approval surfaces,
recent runs + 7-day failure count, per-status client counts),
`src/lib/agents/notification-providers.ts` (pure email/WhatsApp/phone
REQUEST contract: consent/opt-out, tenant+recipient validation, E.164 /
email shape, approval required for outreach, idempotency key bounds,
daily send limit, cost budget; **no send function**),
`src/components/dashboard/ceo-report-panel.tsx` (server-rendered panel
covered by the existing Jarvis loading state, with per-section
empty/unavailable states, data gaps and notification status),
`tests/ceo-report.test.ts` (+14 tests). Modified (3):
`src/app/dashboard/jarvis/page.tsx` (renders the panel; report errors are
contained), `package.json` (suite entry), `tsconfig.bridge-test.json`
(pure modules + test). No schema, no migration, no provider dependency,
no outbound message. Quality gate at task 62: **474/474 pass, exit 0;
lint 0; tsc 0; build 0.** Real-DB reads and the panel's runtime rows
remain unverified until B1/B2; hosted CI still never run.

## 13. Website/design review status — design remains UNLOCKED

Marketing site: cinematic dark theme, motion sections, services/trust/process
flows; responsive QA evidenced by desktop/tablet/mobile screenshot artifacts
at repo root; dashboard shell with breadcrumbs, disabled placeholder nav
(honest — 7 of 11 nav entries disabled rather than broken links (V)).
Loading/error boundaries exist for every dashboard data surface (V:
`loading.tsx`/`error.tsx` inventory). Accessibility: **limited manual +
scripted audit passed (task 55)** — landmarks/headings/anchors, keyboard
path, focus visibility, form labels, tap targets, and text contrast all
verified on `/`, `/login`, `/signup`, `/forgot-password`, and the 404 page
with 0 remaining automated-contrast failures and 0 console errors;
genuine defects fixed (nested password label, fabricated login/footer
status claims, low-opacity text, 20 px footer targets). **Scope: a limited
audit of the public site — NOT a WCAG conformance claim, no assistive-tech
user testing, dashboard pages auditable only as source (no local login).
**DESIGN STATUS: UNLOCKED.** No design lock has been declared and iteration
remains open. Finalizing the design for launch requires (1) a final visual
review by the human CEO and (2) an explicit human **`LOCK`** approval
recorded in this document — until both happen, no wording here may describe
the design as final. (Root QA screenshot artifacts are local-only evidence,
gitignored per task 56 — kept on disk.)

## 14. Client onboarding and commercial readiness

- **Offer:** one narrow pilot — Inbound Lead Capture & Instant Follow-up,
  one channel, one destination, one notification
  (`Docs/SOP/client-acquisition-readiness.md`) — maps 1:1 to the verified
  lead-capture slice (V).
- **Onboarding flow:** signup → confirm → onboarding (create workspace) →
  invite members → create project → map webhook → run. All steps exist; local
  E2E verified for auth+onboarding; invitation runtime unverified (V).
- **Per-client secrets:** integration credentials are references only
  (`vault:integrations/…` in templates; `REPLYFLOW_CRM_WEBHOOK_*` are
  server-side env, never client-exposed) (V).
- **Pricing:** `Docs/Pricing/` is empty; pricing checklist item explicitly
  unchecked — `PARTIAL` (templates only: `pilot-proposal-template.md`,
  one-pager, discovery script, demo script).
- **Prospects (from project records, never modified this task):** 10 researched
  Austin-metro businesses with evidence snippets
  (`prospect-research-and-pipeline.md`, P-001…P-010) **(V)**; **1 contacted**
  (P-001 Austin Roofer, human-approved send 2026-10-17, reply pending) **(V)**;
  **0 confirmed paying clients** **(V)**. The known claim "3 prioritized" is
  **not evidenced** — the pipeline scores ≥70 as "pursue" and lists P-001…P-005
  above threshold, but no record marks exactly three as prioritized; recorded
  as unverified rather than asserted.
- **Support/incident:** SOPs exist for staging setup and production-readiness
  gates; no on-call or incident runbook beyond recovery automation.

## 15. Exact blockers and dependencies

| ID | Blocker | Impact | Owner | Unblocks |
| --- | --- | --- | --- | --- |
| B1 | Staging backup decision (host-side bounded `pg_dump` vs provider snapshot) — **frozen; no retries allowed in audit tasks** | all migration-dependent work | Human CEO | B2 |
| B2 | Apply 21 pending migrations to staging | real-DB verification of everything database-backed, Jarvis task UI | CTO (after B1) | §16 items 1–3 |
| B3 | LLM API key + base URL (optional per-org) | real model planning | CEO/CTO | adaptive plans |
| B4 | n8n instance + API key | n8n-executed workflows | CEO | template runtime 2–6 |
| B5 | CRM webhook endpoint + secret (client-supplied per pilot) | real lead delivery | CEO + client | pilot go-live |
| B6 | Fixed pilot pricing | outbound checklist, proposals | CEO | first proposal |
| B7 | Vercel project env + confirmation of crons | production readiness | CTO (needs B1 context) | go-live |

## 16. Missing features, prioritized by impact and risk

1. **Staging recovery + migration application (B1→B2)** — highest impact: gates
   all database-backed verification. Risk of rushing: data loss (hence frozen).
2. ~~Jarvis task-creation UI + task list~~ — **DONE (task 53)**: form, server
   action, task list, honest empty/blocked states; 29 unit tests (V).
3. ~~Jarvis approval & execution controls~~ — **DONE (task 54)**: Approve &
   run / Reject (owner/admin, pending tasks) + explicit Run task (writer,
   queued, gate satisfied); 30 unit tests (V); CAS-lost races read as
   "nothing changed", never success.
4. **CI proven green on GitHub** — workflow built and locally validated
   (task 52, `.github/workflows/ci.yml`); only the GitHub-hosted run remains,
   which requires a push/pull request (CEO-visible, outside audit scope).
5. **Error tracking (Sentry free)** — before any real client traffic.
6. **Transaction email (Resend free tier)** — owner notifications beyond the
   dashboard.
7. **Agent hierarchy steps 2–5** (managers, chairmen, registry seeding) —
   after B2.
8. **Workflow templates 2–6 execution** — after B4/B5 credentials.
9. **Billing/usage limits** — before scaling beyond pilots.
10. ~~Accessibility audit~~ — **DONE (task 55)**: limited scoped audit of the
    public site + auth pages via Playwright MCP (landmarks, keyboard, focus,
    labels, contrast, mobile, console); genuine defects found and fixed with
    before/after browser evidence; auth-guarded dashboard fixes are
    source-only. Not a WCAG conformance claim (§13).
11. ~~Repo hygiene~~ — **DONE (task 56)**: `.env.example` un-ignored after
    placeholder verification; qa-*/audit screenshot artifacts ignored (kept
    on disk); empty typo dir removed; secret-shape/logging scans clean;
    `N8N_CALLBACK_SECRET` confirmed dead (0 code refs; stale name only in
    ignored env files, never touched). Follow-ups surfaced: **ci.yml and 3
    demo scripts are untracked** (must be in the next commit), tracked root
    `index.html` is obsolete but preserved for human review.

## 17. Pre-client foundation checklist

| # | Item | Status |
| --- | --- | --- |
| 1 | Marketing site + auth + dashboard shell | DONE-VERIFIED |
| 2 | Client/project/run management (unit-verified) | DONE-VERIFIED |
| 3 | Lead capture slice end-to-end (local, mocked delivery) | DONE-VERIFIED |
| 4 | Approval gates + audit trail | DONE-VERIFIED |
| 5 | Agent orchestrator + identity + authz (unit) | DONE-VERIFIED |
| 6 | Jarvis honest status page | DONE-VERIFIED |
| 7 | Security headers/CSP/rate limits/signatures | DONE-VERIFIED |
| 8 | Staging backed up + migrations applied | **BLOCKED (B1)** |
| 9 | Real-database verification pass | BLOCKED (B2) |
| 10 | CI | `IMPLEMENTED-UNVERIFIED` (workflow created + locally validated; first GitHub-hosted run still pending) |
| 11 | Error tracking | NOT BUILT |
| 12 | Jarvis task UI | **DONE-VERIFIED** (unit, tasks 53–54: create form + list + approve/reject/run controls; runtime `IMPLEMENTED-UNVERIFIED` until B2) |
| 13 | Pricing fixed | PARTIAL |
| 14 | First paying client | NOT STARTED (1/1 contacted, 0 replied) |
| 15 | Accessibility audit (public site, limited scope) | **DONE-VERIFIED** (task 55: browser re-verification 0 contrast failures on 5 routes, labels/targets/console checked; dashboard fixes source-only) |
| 16 | Repo hygiene + secret-handling audit | **DONE-VERIFIED** (task 56: gitignore fixes verified via `check-ignore`; scans clean; 444/444 re-run; env files untouched) |

Counts for this checklist only: **9 DONE-VERIFIED · 1 IMPLEMENTED-UNVERIFIED
(CI, pending first remote run) · 1 PARTIAL · 3 NOT BUILT/NOT STARTED · 2
BLOCKED** (items 8–9 counted as BLOCKED; 14 as NOT STARTED within NOT BUILT;
item 12 counted as DONE-VERIFIED with real-DB runtime noted; items 15–16
counted as DONE-VERIFIED with their stated scope caveats).

## 18. 10-client roadmap (restructured task 58)

**Business baseline — tracked separately from verified engineering
outcomes:** **10 prospects researched · 1 contacted (P-001, 2026-10-17,
human-approved send, reply pending) · 0 paying clients.** Source: project
records (reported baseline). Independently audited caveat: no record
evidences "3 prioritized" (§14, decision 8). Engineering verifications
(444/444 etc.) do not validate any of these sales numbers.

**Stage 1 — Pre-client foundation (NOW; mostly DONE).** Delivered: master
doc, CI workflow, Jarvis status + Task Center (tasks 51–57), a11y audit
(task 55, limited scope), hygiene (56), commit plan (57), this dashboard
(58). Jarvis/agents available now: status page + task center
(unit-verified; real-DB runtime needs B2), 1 worker (ops-assistant,
unit-verified), deterministic planner. Exit criteria: **Task 60 push → CI
proven green (§16 item 4) → B1/B2 staging verification → Sentry live →
pricing fixed (B6).** Each item independently shippable; do not block on
advanced agent capabilities.

**Stage 2 — First paid pilot.** CEO: pricing (B6) + SOP trail (P-001
follow-up within the tracker's max-3-touches rule, P-002…P-005
human-approved messages only, `discovery-call-script.md`, pilot proposal
template) → deliver the one-channel pilot with client-supplied CRM webhook
(B5). Jarvis needed: task create/approve/reject/run **already unit-built**
— verify at B2; **chat is NOT required for the pilot.** Do not delay the
pilot for Jarvis chat, agent hierarchy, billing, or reporting.

**Stage 3 — Clients 1–3.** Per-client: workspace + project + webhook
mapping + one channel; tracker metrics (≤60 s owner alert, 100% lead
capture, zero unexplained failures, zero unapproved sends, zero
duplicates); weekly reviews. Jarvis/agents needed: ops-assistant only
plus **transactional email (owner alerts, §16 item 6)** and error
tracking (§16 item 5).

**Stage 4 — Clients 4–6.** Productize: second channel (needs email
provider or WhatsApp decision), follow-up sequences, reporting digest
(reports page must be built). Jarvis needed: reporting/rollup capability
— manager-level agents **only where they replace manual delivery work**,
still behind approval gates.

**Stage 5 — Clients 7–10.** n8n-executed flows where a real instance
exists (B4); billing/usage guardrails before volume (§16 item 9); second
channel fully productized. Jarvis needed: hierarchy step 2 (managers,
after B2) if — and only if — workload justifies it.

**Stage 6 — Post-10-client autonomy and scale.** Chairmen, agent→agent
delegation, autonomous rollups — all gated on proven value from stages
3–5, with human approval gates retained for every consequential action
(§19 decision 2 remains in force).

Gate rule for all stages: client validation is **never** delayed until
advanced agent capabilities are complete; capability work proceeds only
when a stage demands it.

## 19. Decision log (with evidence)

| # | Decision | Rationale / evidence |
| --- | --- | --- |
| 1 | Jarvis nav kept and enabled, backed by an honest status page | declared architecture intent partially implemented (tasks 47–50) |
| 2 | No fake autonomy anywhere | approval gates unit-tested; page language "It is not autonomous" (V) |
| 3 | Staging commands remain frozen; B1 escalated to the CEO | task 47 audit; re-affirmed here — no retry attempted |
| 4 | Agent logical id never reaches uuid FK columns; per-org identity rows created on first start | task 49 fix + 12 unit tests (V); real-DB still unverified |
| 5 | maybeSingle read hardened with ORDER BY + LIMIT 1 after confirming PGRST116 client behaviour in installed postgrest-js | task 50 (V) |
| 6 | Approver roles for agents reuse `LEAD_APPROVAL_APPROVER_ROLES` (single source) | `authz.ts` + tests (V) |
| 7 | Master document consolidated here; prior backlog demoted to history | task 51 — avoids competing masters |
| 8 | "3 prioritized prospects" recorded as unevidenced | no project record marks three; tracker shows one contacted (V) |
| 9 | Passing unit tests are never equated with production readiness | stated in §12 and every DB-backed status label |
| 10 | CI pins Node 24.15.0 and needs **no** env/secret values for `next build` | exact local runtime version; proven by an env-file-free build (exit 0) before claiming it (task 52) |
| 11 | CI status recorded as `IMPLEMENTED-UNVERIFIED`, not "passing" | the workflow has never executed on a GitHub runner (task 52) |
| 12 | Task Center form is disabled unless a read-only probe confirms the runtime tables; the "empty state" is shown ONLY when persistence is verified | a missing table must read as the B1/B2 blocker, never as "no tasks yet" (task 53, tests assert the copy) |
| 13 | The title bound moved to `types.ts` (`AGENT_TASK_TITLE_MAX_LENGTH`) instead of duplicating "200" in the UI | one source of truth; existing `normalizeStartInput` behaviour unchanged (414/414 still green) |
| 14 | The approve button is labelled "Approve & run" because `resolveAgentApproval` EXECUTES the approved plan synchronously | the UI must state what actually happens (task 54; outcome mapper asserts both facts in tests) |
| 15 | No self-approval prohibition was invented; the policy gap is documented in `task-center.ts` and §6 | `lead-approval-core.ts` defines a role boundary (owner/admin) only — adding a requester-vs-approver rule would be a new product decision for the CEO (task 54) |
| 16 | Explicit Run stays a human click; nothing executes automatically after approval or creation | `canShowRunControl` requires a queued task with a satisfied gate; no autonomous loops anywhere (task 54, tests) |
| 17 | Fabricated success/status copy is treated as a defect and rewritten honestly, even on decorative panels | login panel claimed "Connected / AI running / Automated / Synced", "ReplyFlow production systems", green "Operational" and a fake 82% bar; footer claimed "Systems operational" — all replaced with capability-neutral copy ("Workspace scope", "In preview", "Built on ReplyFlow OS") (task 55, browser-verified) |
| 18 | Contrast fixes were made only by raising opacity tiers of the existing palette (white/paper/blue families), never by swapping colors | keeps the dark cinematic design direction intact while clearing 4.5:1 — design stays UNLOCKED, no visual redesign (task 55: 9 homepage + 8 login failures → 0) |
| 19 | Disabled dashboard sidebar controls were intentionally left at low opacity (WCAG disabled-control exemption) rather than "fixed" | bumping them would misrepresent disabled state; the four enabled-text tiers in the same file were raised (task 55) |
| 20 | The a11y result is recorded as a **limited audit with evidence**, not as WCAG conformance | no assistive-tech/AT-user testing, contrast scanner is homegrown, dashboard pages could not be rendered logged-in — those fixes are source-only; §13 and §16 item 10 carry the same scope caveat (task 55) |
| 21 | `.env.example` was un-ignored (`!.env.example`) only after verifying the file contains zero real values (every value empty; 0 jwt/sk-shaped strings; 0 N8N_CALLBACK_SECRET) | the `.env*` rule swept the shareable template into invisibility; a template that cannot be tracked cannot document the env schema (task 56, `check-ignore` verified both states) |
| 22 | Local screenshot evidence (28 root `qa-*` files, 44 `audit/` design-review images) was **ignored, never deleted** | keeps the files on disk as evidence while preventing multi-MB binary noise from ever entering commits; consistent with the pre-existing `smoke-*.png` and `.playwright-mcp/` rules (task 56) |
| 23 | The untracked `.github/workflows/ci.yml` and 3 untracked `scripts/demo-*.mjs` files were reported, **not staged or committed** | staging/committing is out of scope for audit tasks; they are flagged as mandatory inclusions for the next CEO-authorized commit session — a clone today would lack CI and the three `npm run demo:*` entry points would fail (task 56) |
| 24 | `N8N_CALLBACK_SECRET` recorded as dead: zero code references (the live HMAC var is `REPLYFLOW_CALLBACK_SECRET` in callback routes, dispatch scripts, and tests); the stale name exists only as an unused line inside `.env.local` + `.env.local.backup` | both files are ignored, were never opened, and were never modified (hard rule); no rotation is needed because no code ever reads the obsolete name; removal is a human env-file edit (task 56) |
| 25 | Tracked root `index.html` was preserved despite being obsolete (Next.js never serves a root-level index.html; zero references in src/scripts/config/CI; 12-commit history) | it is a tracked user file — deletion requires explicit human review; recorded here so the next commit session can decide (task 56) |
| 26 | Task 57 produced a commit plan only — the Git index and history were **not** modified, and the branch is knowingly **ahead 12** of origin | 54 modified / 71 untracked / 0 staged re-verified after two session interruptions; groups G1–G8 + migrations-separate are recorded in §12 and the task-57 report; executing them requires explicit CEO authorization (task 58) |
| 27 | The task-57 G1–G8 plan was replaced by the task-59 release gate §23: 7 releasable groups (C1–C7) with exact membership, mandatory commit order `C1 → C3 → C4 → C2 → C5 → C6 → C7`, migrations **C8 held**, and 1 group marked NEEDS MANUAL REVIEW | fresh import-graph analysis found a C2⇄C4 cycle (`run-live.tsx` → `run-event-timeline.tsx` → `run-observability-core.ts`) resolved by moving the approval-aware timeline into C4 — no file may appear in two groups; quality gate 444/444 + lint 0 + tsc 0 + build 0 at task 59; `.env.example` history check shows the old tracked version had **all-empty values** so current template content is genuinely new (task 59) |
| 28 | Task 60 selected **approver actor attribution** (`decided_by_user_id` in every approval-decision audit event on both the lead-capture and Jarvis agent surfaces) as the single bounded improvement; implemented payload-only with optional context fields — no schema change, no self-approval rule invented | ranked against the 6 ordered capability questions: it is the highest-impact gap implementable without B1/B2/B5/B6/CEO accounts (durability and real-client delivery are blocked; CI-green needs the §23 push); runner-up (pilot-readiness doctor script) deferred to keep one bounded scope; attribution also supplies the audit foundation for any future CEO-decided self-approval policy (decision 15); 451/451 + lint 0 + tsc 0 + build 0 at task 60 |
| 29 | Task 61 added the **pilot readiness doctor** (pure module + CLI + 9 tests) and a canonical pilot specification (§24) instead of rebuilding any lead-capture code; the readiness command is report-only (exit 0) and presence-only (no values) | delivery-flow validation found no unblocked correctness gap in capture/qualification/approval/delivery (all unit-verified); the highest-value missing piece was a repeatable go-live evidence check usable before each client conversation; the doctor's best local verdict is "STAGING VERIFICATION REQUIRED", never "ready", because staging/CRM/pricing remain human-owned (B1/B2/B5/B6); 460/460 + lint 0 + tsc 0 + build 0 at task 61 |
| 30 | Task 62 added a **read-only CEO report** (pure builder + server service + dashboard panel + 14 tests) and a **notification request contract** (validation only, no send path) — no new persistence, queue or provider | the report reuses rows already owned by the workspace (agent tasks, both approval surfaces, workflow runs, clients) and labels an unreadable source as unknown instead of zero; notification delivery stays unimplemented because no approved provider, consent records, opt-out storage or cost metering exists, and a send path without them would be unsafe; 474/474 + lint 0 + tsc 0 + build 0 at task 62 |

## 20. Next single CTO task

**Task 63 — CEO-authorized commit session executing the §23 decision
sheet:** (this slot has rolled forward three times: task 60 was reassigned
to the Jarvis MVP / first-client acceleration work — decision 28, task 61
to first-client delivery readiness — decision 29, and task 62 to CEO
reporting — decision 30 — so the commit session is now task 63.)
(1) obtain explicit CEO authorization for each group marked
READY FOR CEO APPROVAL (C1–C6) plus the 2-value visual check that clears
C7 (`.env.example` 2 space-free values + 1 demo-script literal — values
printed to the CEO, never into documents or logs); (2) stage group-by-group
in the mandatory order `C1 → C3 → C4 → C2 → C5 → C6 → C7` with a
`git check-ignore` guard before every stage proving no `.env.local*` or
secret-bearing file can enter the index; (3) commit per group with the
prepared messages, verifying after each group that `git status` contains
only the intended remainder; (4) push `feat/client-management-foundation`
(this also ships the 12 already-committed UI-era commits and unblocks the
first GitHub-hosted CI run — §16 item 4, ci.yml triggers on this push);
(5) observe and record the CI result. **C8 migrations never inside code
commits** — separate CEO/DB decision tied to B1/B2; runtime degrades
gracefully without them (42703 approval fallback; agent tables missing →
Jarvis/agent runtime errors until C8 applies, which is a runtime, not a
build, dependency — task 59 mapping). Stop immediately if any staging
step would include a secret file or if authorization is absent.
Remaining §16 items still need B1/B2, CEO accounts
(Sentry/Resend/pricing), or B4/B5 credentials; B1 stays visible and
frozen for the human CEO.

## 21. Daily and weekly execution tracker

Statuses: `DONE` · `VERIFIED` · `PARTIAL` · `BLOCKED` · `NOT STARTED`.
Only known activity is seeded; unknown dates stay blank — no historical
activity is invented. Weekly review = same table, week-ending summary row.

| Date | Daily target | Actual work completed | Evidence | Test / verification | Blocker | Next task | Sales action & outcome |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-21 | CTO tasks 51–57 (master doc, CI workflow, Jarvis task center, a11y audit + fixes, hygiene, commit plan) | all 7 executed | §12 file manifests; HEAD `646f9f5`, worktree preserved | `test:bridge` **444/444** (V); lint/tsc/build 0 (V) | B1 frozen (staging) | task 58 | P-001 reply pending; no new outreach (not authorized) |
| 2026-10-22 | Task 58 — consolidate master doc into operating dashboard | sections A–H added/updated in this file (§1A, §3 layer table, §5 CRM row, §10 tool table, §11 release checklist, §13 LOCK gate, §18 six-stage roadmap, §21–§22) | this document, task-58 edits | `test:bridge` 444/444 re-run at task 58 (§12) | B1 frozen | task 59 | none (outreach requires human approval) |
| 2026-10-22 | Task 59 — pre-release readiness gate + CEO commit plan | 8 groups classified with exact membership; C2⇄C4 import cycle found+resolved; migration/runtime map; secret-shape scan (0 key shapes; 2 manual-review items); CI yml inspected; §23 added | §23 decision sheet; decision 27 | gate: `test:bridge` **444/444** + lint 0 + tsc 0 + build 0 (V); hosted CI NOT RUN | B1 frozen | task 60 | none (outreach requires human approval) |
| 2026-10-22 | Task 60 — Jarvis MVP/acceleration: approver actor attribution on both approval surfaces | 4 production files + 2 test files modified; `decided_by_user_id` recorded in every approval-decision event (lead + agent), payload-only, optional-field back-compat | §12 task-60 manifest; decision 28; §6 matrix rows updated | gate: `test:bridge` **451/451** + lint 0 + tsc 0 + build 0 (V); hosted CI NOT RUN | B1 frozen | task 61 (commit session, §20) | none (outreach requires human approval) |
| 2026-10-22 | Task 61 — first-client delivery readiness + release gate | delivery flow validated end-to-end at code/test level (§24 matrix); pilot readiness doctor added (pure module + CLI + 9 tests); one-pilot specification written (§24); readiness = PARTIAL, verdict NOT READY locally | §24; decision 29; §12 task-61 manifest; `npm run pilot:readiness` real output | gate: `test:bridge` **460/460** + lint 0 + tsc 0 + build 0 (V); hosted CI NOT RUN | B1/B2/B5/B6 (staging, real CRM, pricing) | task 62 (commit session, §20) | 10 prospects · 1 contacted (P-001 reply pending) · 0 paying; no new outreach (not authorized) |
| 2026-10-22 | Task 62 — Jarvis CEO reporting + notification contract | read-only CEO report on the Jarvis page (tasks, both approval surfaces, recent outcomes/errors, client pipeline, next action, data gaps); email/WhatsApp/phone request contract with consent/approval/idempotency/rate/cost validation and **no send path**; AI cost honestly unknown | §25; decision 30; §12 task-62 manifest; §6 matrix rows | gate: `test:bridge` **474/474** + lint 0 + tsc 0 + build 0 (V); real-DB rows NOT verified (B2); hosted CI NOT RUN | B1/B2/B5/B6; notifications need provider + consent storage (future task) | task 63 (commit session, §20) | 10 prospects · 1 contacted · 0 paying; no sends, no outreach (not authorized) |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |

## 22. Daily operating rule (every subsequent task)

Each CTO task must: **(1)** inspect current evidence first (git state,
this tracker, §12) — never assume; **(2)** select exactly one
highest-value next task from §20; **(3)** preserve all existing work (no
reset/clean/revert of user files); **(4)** implement and test only the
chosen scope; **(5)** update this canonical tracker (§21 row + §20
roll-forward) — no competing documents; **(6)** report `DONE` / `VERIFIED`
/ `PARTIAL` / `BLOCKED` and the next task. When blocked, switch to safe
independent work instead of repeating the failed operation indefinitely
(frozen B1 is never retried from an audit task).

## 23. Release gate and CEO commit decision sheet (task 59, 2026-10-22)

**Gate state (fresh, not assumed):** branch `feat/client-management-foundation`
· HEAD `646f9f5` · upstream `origin/feat/client-management-foundation` ·
**ahead 12, behind 0** · staged **0** · stashes **0** · 253 tracked files ·
**133 changed files = 54 modified + 79 untracked** (110 `git status --short`
lines because fully-untracked directories collapse — file counts from
`git diff`/`git ls-files` are authoritative). Exact membership below; no
file appears in two groups (128/128 verified at task 61; task 62 added 5
new files each to exactly one existing group, giving 133/133, 0 overlaps).

**Quality gate (task 62 run, latest):** `test:bridge` **474/474 exit 0**
(was 460/460 at task 61, 451/451 at task 60; +14 CEO-report/notification
tests) ·
`lint` exit 0 · `tsc --noEmit` exit 0 · `next build` exit 0 ·
**GitHub-hosted CI: NEVER EXECUTED (unverified)** — local results do not
prove production readiness; the first push (Task 63) triggers the first
real CI run. ci.yml inspected: triggers push/PR on this branch +
`workflow_dispatch`; `permissions: contents: read` (least privilege);
zero `secrets.*` references; Node 24.15.0 = local; 20-min timeout.

**Dependency safety (import-graph analysis, task 59):** 122 import edges
among changed files resolved; 0 modified files import untracked modules
EXCEPT the 3 found and assigned within-groups; a C2⇄C4 cycle
(`run-live.tsx` C4 → `run-event-timeline.tsx` C2 →
`run-observability-core.ts` C4; `projects/[id]/page.tsx` C2 →
`run-observability.ts` C4) was resolved by placing the approval-aware
`run-event-timeline.tsx` **in C4**. Remaining cross-group edges are
acyclic under the mandatory order **C1 → C3 → C4 → C2 → C5 → C6 → C7**:
C2→C4 (`projects/[id]/page.tsx`, `runs/page.tsx` → `run-observability`;
`ceo-report-panel.tsx` → `ceo-report`), C2→C3 (jarvis
pages/actions → `@/lib/agents/*`), C4→C3 (`ceo-report-service.ts` →
`task-center`), C5→C4/C3 (tests import `@/lib/workflows`,
`@/lib/agents`, recovery-service). Note: only the
FINAL pushed HEAD is CI-tested — intermediate commits are not — so the
order rule is a bisectability/history-quality requirement, not a CI one.

**Migration runtime map (read-only; C8 never staged/applied):**

| Unapplied migration | Schema | Dependent runtime features | If not applied |
| --- | --- | --- | --- |
| `20261005…workflow_run_approval_state` | `workflow_runs.approval_state` column | C4 lead-approval controls | approval queries error; non-approval code falls back (42703 handled) |
| `20261006…agent_runtime_foundation` | `ai_agents`, `ai_agent_tasks`, `ai_agent_task_events`, `ai_agent_memory` + RLS + policies | C3 agent runtime, C2 Jarvis task center | those pages/APIs fail at runtime (tables missing) |
| `20261007…restrict_workflow_run_transition_and_approval` | replaces `apply_workflow_run_transition`, adds approval trigger fn | C4 run transitions (hardening) | old function behavior remains; no breakage |

Build/test/CI are **not** affected by unapplied migrations (SQL never
touched by compile; tests are unit-only — proven by the green gate with
zero DB). Ordering read-only: 20261005 (column) → 20261006 (independent)
→ 20261007 (depends on 20261005's column semantics). **B1/B2 stay frozen.**

**Secret handling (task 59 scan; task 61/62 additions inspected):** 125
changed files scanned against key-format patterns (`AKIA…`, `ghp_…`,
`github_pat_…`, `sk-…`, `sb_secret_…`, `eyJ…` JWT, `xox…`, PEM headers):
**0 matches**. Generic `secret|api_key|password|token=` word-hits (8 files)
classified without printing values: env-template entries,
`process.env`/env-helper refs, code lines, test fixtures. The 8 task-61/62
files contain no literal credential: the readiness module/CLI reference
env NAMES only, the notification contract references no provider
credentials at all (validation + status only), and the report service
reads rows — a test asserts fixtures are never echoed. `git check-ignore -v .env.example`
→ the `!.env.example` negation is active (addable, status `??`). History
check: the old tracked `.env.example` (commit `bba7abd`) had **all-empty
values** — current template content was never in git history. **Remaining
review items (values printed only to the CEO, never into documents):**
(1) `.env.example` → `INTERNAL_AUTOMATION_SECRET` (12-char, no spaces)
and `REPLYFLOW_AI_API_KEY` (22-char, no spaces) — the other 4 values are
space-bearing sentences (placeholders by construction); (2)
`scripts/demo-client-capture.mjs` → one 22-char literal secret (local
demo only, contacts no real service).

### Decision table

| # | Group | Files | Recommendation |
| --- | --- | --- | --- |
| C1 | Marketing site + accessibility | 25 (23M+2U) | **READY FOR CEO APPROVAL** (self-contained; a11y evidence task 55) |
| C2 | Dashboard + Jarvis Task Center + CEO report panel | 27 (21M+6U) | **READY FOR CEO APPROVAL** — commit only after C3 and C4 |
| C3 | Agent identity/authorization/runtime | 13 (13U) | **READY FOR CEO APPROVAL** (self-contained; runtime needs C8) |
| C4 | Workflow library + lead capture + approval + reporting | 24 (6M+18U) | **READY FOR CEO APPROVAL** — runtime needs C8 (non-approval degrades) |
| C5 | Tests + tooling | 18 (3M+15U) | **READY FOR CEO APPROVAL** — after C1–C4 (tests import them) |
| C6 | CI configuration | 1 (1U) | **READY FOR CEO APPROVAL** — triggers first CI run on push |
| C7 | Documentation + repo hygiene | 22 (1M+21U) | **NEEDS MANUAL REVIEW** — only `.env.example` (17 assignments, all empty); `.gitignore`/`Docs/*` ready; stage `.gitignore` first in-group |
| C8 | Database migrations | 3 (3U) | **HOLD — DEPENDENCY OR RISK** (B1/B2 frozen; separate CEO/DBA decision; never inside code commits) |

### Exact membership (M=modified, U=untracked; totals 54M+79U=133)

**C1 (25)** — M: `src/app/globals.css`, `src/app/layout.tsx`,
`src/app/page.tsx`, `src/app/not-found.tsx`,
`src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx`,
`src/app/signup/page.tsx`, `src/components/auth-shell.tsx`,
`src/components/lamp-login.tsx`, `src/components/navbar.tsx`,
`src/components/service-detail.tsx`, `src/components/service-experience.tsx`,
`src/components/service-workflow.tsx`, `src/sections/automation-system.tsx`,
`src/sections/cta.tsx`, `src/sections/footer.tsx`, `src/sections/hero.tsx`,
`src/sections/process.tsx`, `src/sections/services.tsx`,
`src/sections/technology-stack.tsx`, `src/sections/trust.tsx`,
`src/sections/why-replyflow.tsx`, `src/sections/workflow.tsx` ·
U: `src/sections/company-os.tsx`, `src/sections/problem-opportunity.tsx`

**C2 (27)** — M: `src/app/dashboard/page.tsx`,
`src/app/dashboard/clients/page.tsx`, `src/app/dashboard/clients/[id]/page.tsx`,
`src/app/dashboard/projects/page.tsx`,
`src/app/dashboard/projects/project-create-form.tsx`,
`src/app/dashboard/projects/[id]/page.tsx`,
`src/app/dashboard/projects/[id]/project-client-selector.tsx`,
`src/app/dashboard/projects/[id]/webhook-map-button.tsx`,
`src/app/dashboard/projects/[id]/workflow-create-form.tsx`,
`src/app/dashboard/projects/[id]/runs/page.tsx`,
`src/components/dashboard/breadcrumbs.tsx`,
`src/components/dashboard/error-panel.tsx`,
`src/components/dashboard/kpi-card.tsx`,
`src/components/dashboard/recent-activity.tsx`,
`src/components/dashboard/sidebar.tsx`, `src/components/dashboard/topbar.tsx`,
`src/components/invite-member-form.tsx`,
`src/components/client-activity-timeline.tsx`,
`src/components/client-intake-form.tsx`,
`src/components/client-profile-summary.tsx`,
`src/lib/dashboard/navigation.ts` · U: `src/app/dashboard/jarvis/actions.ts`,
`src/app/dashboard/jarvis/loading.tsx`, `src/app/dashboard/jarvis/page.tsx`,
`src/app/dashboard/jarvis/task-actions.tsx`,
`src/app/dashboard/jarvis/task-center.tsx`,
`src/components/dashboard/ceo-report-panel.tsx`

**C3 (13, all U)** — `src/lib/agents/` : `agent-identity.ts`, `authz.ts`,
`external-action-adapter.ts`, `jarvis-status.ts`, `memory-core.ts`,
`model-adapter.ts`, `model-provider-openai.ts`, `ops-assistant-service.ts`,
`ops-assistant.ts`, `planner-core.ts`, `task-center.ts`, `tools.ts`,
`types.ts`

**C4 (24)** — M: `src/lib/automation/recovery-service.ts`,
`src/lib/dashboard/run-observability-core.ts`,
`src/lib/dashboard/run-observability.ts`,
`src/app/dashboard/projects/[id]/runs/[runId]/page.tsx`,
`src/app/dashboard/projects/[id]/runs/[runId]/run-live.tsx`,
`src/components/dashboard/run-event-timeline.tsx` ·
U: `src/app/dashboard/projects/[id]/runs/[runId]/approval-actions.ts`,
`src/app/dashboard/projects/[id]/runs/[runId]/lead-approval-controls.tsx`,
`src/app/api/automation/leads/route.ts`,
`src/lib/agents/ceo-report-service.ts`,
`src/lib/agents/ceo-report.ts`,
`src/lib/agents/notification-providers.ts`,
`src/lib/automation/integration-adapter.ts`,
`src/lib/automation/lead-approval-core.ts`,
`src/lib/automation/lead-capture-run.ts`,
`src/lib/automation/lead-capture-service.ts`, `src/lib/leads/lead-capture.ts`,
`src/lib/leads/lead-intake-core.ts`, `src/lib/operations/pilot-readiness.ts`,
`src/lib/workflows/catalog.ts`, `src/lib/workflows/index.ts`,
`src/lib/workflows/instantiate.ts`, `src/lib/workflows/types.ts`,
`src/lib/workflows/validation.ts`

**C5 (18)** — M: `package.json`, `tsconfig.bridge-test.json`,
`tests/automation-runtime-state.test.ts` · U: `tests/agent-identity.test.ts`,
`tests/agent-model-adapter.test.ts`, `tests/agent-ops-assistant.test.ts`,
`tests/ceo-report.test.ts`, `tests/jarvis-status.test.ts`,
`tests/jarvis-task-center.test.ts`, `tests/jarvis-task-controls.test.ts`,
`tests/lead-approval.test.ts`, `tests/lead-capture-workflow.test.ts`,
`tests/pilot-readiness.test.ts`, `tests/workflow-template-library.test.ts`,
`scripts/demo-client-capture.mjs`, `scripts/demo-lead-capture.mjs`,
`scripts/demo-ops-assistant.mjs`, `scripts/pilot-readiness.mjs`

**C6 (1, U):** `.github/workflows/ci.yml`

**C7 (22)** — M: `.gitignore` (stage first) · U: `.env.example`,
20 docs: `Docs/SOP/` ×15 (`ai-operations-assistant-offer`,
`client-acquisition-readiness`, `client-lead-tracker`,
`discovery-call-script`, `first-client-demo-and-offer`,
`first-client-one-pager`, `lead-capture-migration-preflight`,
`lead-capture-production-readiness`, `lead-capture-service-offer`,
`lead-response-followup-offer`, `outreach-drafts`, `outreach-execution-pack`,
`pilot-proposal-template`, `prospect-research-and-pipeline`,
`staging-environment-setup` — all `.md`) and `Docs/architecture/` ×5
(`REPLYFLOW-AI-MASTER-STATUS.md`, `company-agents-architecture.md`,
`pre-client-foundation-backlog.md`, `proposed_workflow_templates_schema.sql`,
`workflow-templates-library.md`)

**C8 (3, U — HOLD):** `supabase/migrations/20261005000000_workflow_run_approval_state.sql`,
`supabase/migrations/20261006000000_agent_runtime_foundation.sql`,
`supabase/migrations/20261007000000_restrict_workflow_run_transition_and_approval.sql`

**First-client pilot readiness: PARTIAL (re-verified at task 62).**
Ready: one-channel code slice exists and is unit-verified (lead capture
+ qualification + approval + workflow templates — C4, 474/474); SOP/
tracker/proposal docs (C7); a11y-checked marketing site (C1); CI to prove
quality on push (C6); a repeatable local readiness command
(`npm run pilot:readiness`, task 61 — presence-only, no values); a
read-only CEO report that shows task/approval/outcome/pipeline state
without write access (task 62; real rows need B2). Not
ready: B1/B2 (migrations applied + real-DB runtime verification — pilot
operations would hit missing `approval_state`/agent tables), B5 (client
CRM webhook), B6 (pricing fixed by CEO), human-approved outreach volume
(0 paying clients; 1 of 10 prospects contacted), notification delivery
(contract only, task 62). Evidence: §5, §11, §14, §15, §24, §25, gate
above.

## 24. Actual lead-capture delivery flow + first-client pilot specification (task 61, 2026-10-22)

This section documents the flow **as implemented** (file:line evidence in
the task-61 report), what is locally verified versus externally blocked,
and the single pilot the team is allowed to sell once the blockers clear.

### 24.1 Delivery flow and verification per stage

| # | Stage | Implementation | Locally verified | Needs staging | Needs client/CEO | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Inbound capture | `src/app/api/automation/leads/route.ts` — HMAC SHA-256 `x-replyflow-signature`, 32 KB body cap, 30 req/60 s rate limit | yes (suite + demo) | endpoint reachable | channel points at URL | 401 bad signature · 413 oversize · 429 rate limit · **503 when intake secret unset** |
| 2 | Validation + normalization | `src/lib/leads/lead-capture.ts`, `lead-intake-core.ts` — field caps, email/phone shapes | yes | — | — | 400 with field-level reasons; no partial writes |
| 3 | Dedup (exactly-once intake) | deterministic fingerprint → `(organization_id, idempotency_key)` unique index; 23505 tolerated as replay | yes (race tests) | unique index present after C8/B2 | — | duplicate payload returns the existing run, not a second delivery |
| 4 | Qualification + tiering | pure rules: hot/warm/cold, free-email-domain signal | yes | — | — | tier drives the gate only; never silently drops a lead |
| 5 | Human approval gate | `lead-approval-core.ts` + `lead-approval-controls.tsx` + `approval-actions.ts`; decision events carry `decided_by_user_id` | yes (unit) | `approval_state` column (migration 20261005) | owner/admin clicks | non-hot tiers skip the gate by policy; pending approvals never time out |
| 6 | CRM delivery | `lead-capture-run.ts` `buildLeadNotification` → `integration-adapter.ts`; `REPLYFLOW_CRM_WEBHOOK_URL`/`_SECRET` | mocked/unconfigured paths yes; **HTTP CRM path only with a fake server** | signed dry-run to staging endpoint | real endpoint + secret (B5) | unconfigured = explicit honest failure, **retryable**; no fake success |
| 7 | Audit trail | append-only run events incl. actor attribution, transition RPC | yes (unit) | RPC hardening (20261007) | — | events are the source of truth; UI timeline reads them |
| 8 | Recovery + reporting | `recovery-service.ts` (stale queued/running classification); run page + `run-event-timeline.tsx` | yes (unit) | deployed crons (B7) | — | no blind retry; pending approvals excluded from the sweep |

Honesty boundary: stages 1–5 and 7–8 are verified as code; stage 6's real
network path is **not** verified end-to-end, and no customer data has ever
traversed the system. Mocked delivery is never described as live delivery.

### 24.2 One-pilot specification (internal; not a customer contract)

- **Ideal client:** a 5–50 person B2B service business that already buys
  leads (paid ads or a form) and currently answers them manually in
  under a day, with a CRM that accepts an inbound webhook (HubSpot,
  Pipedrive, Zoho, or a Zapier/Make catch hook).
- **Pilot scope (one channel, 14 days):** one inbound form or ad lead
  source → ReplyFlow intake → qualification → owner approval for hot
  leads → signed handoff to the client's CRM → event timeline and a
  weekly outcome summary from the dashboard.
- **Explicitly out of scope:** multi-channel capture, outbound
  sequencing/email sending, billing automation, custom integrations
  beyond one webhook, data migration of historical leads, and any
  "guaranteed pipeline" claim.
- **Credentials the client must supply:** CRM inbound webhook URL +
  shared secret (or a Zapier/Make catch hook URL), the form/ad channel
  to point at us, and one owner/admin account for approvals.
- **Onboarding (human-run):** discovery call → confirm the one channel
  and CRM → staging dry-run with a synthetic hot lead → sign-off on the
  acceptance criteria → point the channel live → daily check for the
  first 3 days.
- **Acceptance criteria (measurable):** (a) 100% of test submissions
  produce exactly one run; (b) duplicate submissions produce no second
  delivery; (c) hot leads cannot reach the CRM without an approval
  recorded with an actor; (d) every delivery attempt is visible in the
  timeline with its outcome; (e) a failed delivery is retryable and
  never shows as success.
- **Support model:** one named human operator, business-hours response,
  written incident note for any missed lead; no 24/7 SLA during pilot.
- **Pricing:** **CEO-owned (B6)**. No number is recorded in the
  repository; the proposal template keeps a placeholder. The pilot is
  not sellable until that decision exists.
- **Claims discipline:** say "one channel, human-approved handoff,
  measured for 14 days"; never "AI sales agent", never "fully
  automated", never a result guarantee.

### 24.3 Readiness status (task 61, re-checked at task 62)

`npm run pilot:readiness` is the repeatable check. Locally it correctly
reports **NOT READY** (no credentials, migrations unapplied, pricing
absent). Its ceiling is **STAGING VERIFICATION REQUIRED** even with all
names configured — never "ready". Blockers in order: CEO authorization +
§23 push (task 63) → B1 staging backup → B2 migrations + real-DB runtime
→ B5 client CRM endpoint/secret → B6 pricing → B7 hosted env/crons.
Task 62 improves *visibility* before those clear (CEO report), not the
underlying readiness. Sales baseline is unchanged: 10 prospects, 1
contacted (P-001, reply pending), 0 paying clients.

## 25. Jarvis CEO report + notification-provider readiness (task 62, 2026-10-22)

**Purpose.** Give the CEO one read-only answer to "what is happening, what
needs me, what should happen next" from data the workspace already owns —
with every unreadable source labeled unknown rather than zero.

**Report fields and sources** (`src/lib/agents/ceo-report.ts` pure, 14
tests; `ceo-report-service.ts` read-only, tenant-scoped; panel on
`/dashboard/jarvis`):

| Field | Source (read-only) | When unavailable |
| --- | --- | --- |
| Tasks created / completed / failed / blocked-on-approval / pending approvals | `ai_agent_tasks` counts per status + approval flags; queued + approval-pending counted as blocked | section shows "Unknown" + data gap (B2) |
| Recent workflow outcomes (5) + failures in 7 days | `workflow_runs` join workflow name, newest first | section shows unavailable + gap; approval column degrades on 42703 |
| Pending approvals + responsible role | agent tasks awaiting approval **and** workflow runs `approval_state=pending` (union); role copy = "owner or admin" (mirrors `authz.ts`, not a new rule) | per-source note or unavailable; never implies zero |
| Client pipeline | `clients` per `CLIENT_STATUSES` (6 statuses) + total | unavailable + gap; counts sanitised (negative/NaN/fraction → 0) |
| AI/API cost | **no metering source exists** | always `not-configured`; no estimate is invented |
| Next action | deterministic priority: restore-data → resolve-approvals → review-failures → create-task → run-task → idle → monitor | reason string always present |
| Notification channels | `notification-providers.ts` | all `not-built` |

**Notification contract (documented, deliberately not wired):**
channels `email | whatsapp | phone`; kinds `internal-report | outreach`;
required guarantees: explicit per-recipient consent, opt-out checked
before every send, tenant isolation, approval for outreach, idempotency,
delivery audit. Validation also enforces email/E.164 shape, recipient
length, idempotency-key bounds (8–128), daily limit (200), non-negative
cost and a cost budget, and rejects a blank tenant. **There is no send
function, no provider client, no credential and no queue** — the module
exports only the contract, validation and provider status, and a test
asserts no `send` export exists. Sending stays a separate, future,
CEO-authorized task requiring provider choice, consent storage and a
delivery audit table.

**Missing data sources before this report is operationally true:**
B1/B2 (migration `20261005000000` approval column + `20261006000000`
agent tables applied, real rows readable), a cost/metering source,
and notification consent/opt-out storage. None is faked locally.

**Verification:** `test:bridge` 474/474 exit 0; the service issues only
`select`-style reads (no insert/update/delete/upsert/rpc — asserted in
the test); the panel and service compile in `next build`; runtime rows
remain unverified until B2. Next task remains the CEO-authorized commit
session (task 63, §20/§23); no sends and no outreach were performed.
