# Lead Capture & Qualification — Client Offer

> Operational and selling reference only. Do **not** contact prospects, send
> outbound messages, create accounts or incur costs as part of working this
> document. It prepares and scopes the offer; a human sends anything outbound.

This is the first workflow slice that is genuinely **executable** (not just a
template definition). It captures an inbound lead, normalizes and qualifies it
deterministically, records a durable run in the existing automation runtime, and
either delivers it to a CRM or holds it behind a human approval gate.

## What the client gets (one narrow offer)

For a single inbound channel (a website form or a webhook endpoint):

1. **Capture** — accept a lead payload (`name`, `email`, optional `phone`,
   `company`, `message`, `source`).
2. **Validate & normalize** — reject malformed submissions with safe errors;
   trim/collapse whitespace, lowercase the email, normalize the phone to
   `+`/digits.
3. **Qualify deterministically** — every lead gets the same score and tier for
   the same inputs. No model call, no randomness.
4. **Record a durable run** — one `workflow_runs` row (`trigger_type = webhook`)
   with a stable idempotency key, plus an append-only event timeline
   (`run.queued` → `run.dispatching` → `run.integration_delivered` / `run.failed`;
   a hot lead stops at `run.approval_required`).
5. **Deliver or gate** — deliver to the configured CRM; hold high-value (hot)
   leads for owner approval before any outreach.

One channel, one qualification rule set, one destination. Nothing more.

Every state change is applied through the existing atomic transition RPC
(`apply_workflow_run_transition`), so the status change and its audit event
commit together and every write is a compare-and-set against the status the
orchestrator observed — a concurrent actor can never double-deliver or overwrite
a newer state.

## Qualification rules (deterministic, explainable)

| Signal | Points |
| --- | --- |
| Business (non-consumer) email domain | +40 |
| Phone provided | +20 |
| Company provided | +15 |
| Message provided | +5 |
| Message is 40+ characters | +10 |
| Source is `website` or `referral` | +10 |
| Source is `ads` | +5 |

Tier: **hot** ≥ 70, **warm** ≥ 40, otherwise **cold**. `qualified` = warm or hot.
`requiresApproval` = hot (mirrors the template's `gate-hot-lead` owner gate).

## Idempotency & safety guarantees

- The same lead (same normalized email + phone) can never create a second run —
  enforced by the existing `(organization_id, idempotency_key)` unique index, with
  the race case (unique violation) resolved to the existing run.
- A hot lead is **not** contacted until an owner approves; approval and rejection
  are one-shot (a repeat decision is refused, so the consequential action fires
  exactly once).
- Delivery failure marks the run `failed` with `error_code =
  INTEGRATION_DELIVERY_FAILED` and a human-readable message — never a fake success.

## What is real vs. mock (say this honestly in a demo)

- **Real, this slice:** validation, normalization, qualification, durable run +
  event writes, atomic state transitions, idempotency, the durable approval gate,
  the authenticated owner/admin approval action, the inbound HMAC-authenticated
  endpoint, and failure handling.
- **Real, opt-in:** `createHttpCrmAdapter` (signed, idempotent, timeout, bounded
  retries) when a CRM webhook URL + secret are configured. Not configured by
  default.
- **Mock, this slice:** in tests and the local demo the external CRM step runs
  through `createMockNotificationAdapter`; with neither a configured adapter nor
  mock, delivery fails honestly (`createUnconfiguredIntegrationAdapter`).
- **Not wired in this slice:** dispatch to n8n. Runs created here are executed
  synchronously by the orchestrator and completed (`succeeded`/`failed`); the
  n8n dispatch + HMAC-callback path is a separate, security-sensitive follow-up.

## Inbound endpoint & authentication

Leads are accepted by `POST /api/automation/leads`. The endpoint is
machine-to-machine and is enabled only when `REPLYFLOW_LEAD_INTAKE_SECRET` is
set; otherwise it returns `503` rather than accept an unauthenticated lead.

- The exact raw body must be HMAC-SHA256 signed with that shared secret and sent
  in the `x-replyflow-signature` header (`sha256=<hex>`). The same primitive the
  n8n callback path uses, so both inbound surfaces share one scheme.
- Requests are IP rate limited (30/min) before any work.
- The body carries lead PII and is **never logged**; log lines use only a
  non-reversible fingerprint over the body for correlation.
- The body is a routing envelope
  (`organization_id`, `project_id`, `workflow_id`, optional `client_id`, `lead`);
  the `lead` object is validated by the same pure engine as the demo.

## External CRM adapter

There is no default real adapter. When a customer-owned CRM webhook is
explicitly configured via `REPLYFLOW_CRM_WEBHOOK_URL` **and**
`REPLYFLOW_CRM_WEBHOOK_SECRET`, the orchestrator uses `createHttpCrmAdapter`:

- POSTs a signed JSON body with a stable `idempotency-key` (a hash, so the
  reference is not exposed in a header).
- Bounds every attempt with a timeout, retries network errors and 5xx with capped
  backoff, and treats 4xx as a non-retryable rejection.
- Never reports success it cannot prove; an unconfigured environment fails
  honestly via the unconfigured adapter.

Until a real endpoint and secret are supplied for the client's system, the
delivery step remains a mock (tests/demo) or fails honestly (unconfigured).

## Approval lifetime (now durable)

The run status vocabulary is fixed (`queued`, `running`, `succeeded`, `failed`,
`cancelled`) with no `awaiting_approval` state. A hot lead awaiting approval is
held as `queued` **with `approval_state = 'pending'`**, a durable column added by
migration `20261005000000_workflow_run_approval_state.sql`.

The recovery sweep explicitly excludes `approval_state = 'pending'` runs (in both
the scan and the terminalize write), so a pending approval is a legitimate
waiting state and is **no longer failed by the dispatch timeout**. Resolving the
gate is a compare-and-set on `(status = 'queued', approval_state = 'pending')`, so
a concurrent or repeated decision is refused and the consequential delivery fires
exactly once. A rejected approval cancels the run.

### Resolving the gate (authenticated)

An owner/admin resolves a pending gate through the authenticated server action
`resolveLeadApprovalAction`
(`src/app/dashboard/projects/[id]/runs/[runId]/approval-actions.ts`). The browser
submits only `projectId`, `runId` and `decision`; the action resolves the actor
and role from the session, requires an owner/admin role, reads the run through the
RLS client scoped to that organization, then calls the existing server-side
service. A rejection cancels the run and never dispatches. The authorization
rules and outcome mapping are pure and fully unit-tested
(`src/lib/automation/lead-approval-core.ts`, `tests/lead-approval.test.ts`).

The action is implemented, tested **and wired to the dashboard**: the run detail
page renders an owner/admin-only Approve/Reject control
(`lead-approval-controls.tsx`) while the run is held at the gate. Members see the
gate status but cannot resolve it.

## Local proof (no DB, no network)

- `npm run demo:lead-capture` — runs the real orchestration against an in-memory
  store and a mock adapter, printing the full lifecycle (reject → deliver →
  duplicate → gate → approve → refuse repeat).
- `npm run demo:client-capture` — the **client-facing** demo: the same
  orchestration with the **real** signed HTTP CRM adapter pointed at a simulated
  endpoint, showing immediate delivery, the hot-lead approval gate, idempotent
  duplicates, retry-then-succeed, retry-exhaustion failure and a bounded timeout,
  plus a delivery report.
- `npm run test:bridge` — includes `tests/lead-capture-workflow.test.ts`.

## Delivery readiness checklist

- [ ] `npm run test:bridge` is green (lead-capture suite plus recovery/IPC checks).
- [ ] `npx tsc --noEmit` and `npx eslint` are clean.
- [ ] `npm run demo:lead-capture` shows succeeded / awaiting_approval / duplicate.
- [ ] The approval migration `20261005000000_workflow_run_approval_state.sql` is
      applied to the target database (it is prepared locally, not auto-applied).
- [ ] `REPLYFLOW_LEAD_INTAKE_SECRET` is set for the inbound endpoint.
- [ ] A real CRM endpoint + `REPLYFLOW_CRM_WEBHOOK_SECRET` are configured for the
      client's system (otherwise delivery is mock/unconfigured).
- [ ] The client's qualification thresholds are confirmed (defaults above).
- [ ] The owner role that approves hot leads is agreed and communicated.
- [x] A dashboard control for approving/rejecting a hot lead is added — **done**:
      the run page renders an owner/admin-only control backed by
      `resolveLeadApprovalAction` (`lead-approval-controls.tsx`).
- [ ] The single inbound channel and its destination are confirmed.

## What we deliberately do NOT promise yet

- No outbound multi-channel campaigns, voice, or WhatsApp automation.
- No CRM write-back beyond the single destination adapter.
- No unattended AI decisions — the hot-lead gate stays human-in-the-loop.
- No n8n dispatch for these runs until that path is separately implemented and
  security-reviewed.
- Nothing requiring live credentials beyond a reference/vault the client inserts.

## Discovery questions

1. Where do inbound leads arrive today (form, ad, DM, phone)?
2. Who notices a new lead, and how fast?
3. What makes a lead "worth a human's time"? (Confirm the scoring signals.)
4. Which single destination should receive a delivered lead?
5. Who approves outreach to high-value leads, and how quickly can they act?

## Success metrics / proof to collect

- Time from lead arrival → owner notified (target: under 60 seconds).
- Percentage of captured leads that reach the pipeline (target: 100%).
- Failed runs and root cause (target: zero unexplained).
- One client quote describing a real saved lead.
