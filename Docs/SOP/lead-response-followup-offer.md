# Lead Response & Follow-Up — Client Offer (scoped, honest)

> Selling and scoping reference only. Do **not** contact prospects, send
> outbound messages, create accounts or incur costs as part of working this
> document. A human sends anything outbound.

This is the offer that follows the **Lead Capture & Qualification** slice. It is
scoped deliberately narrowly, and this document is explicit about what is
executable today versus what is a funded next step — so nothing is overpromised.

## The problem this solves

Speed-to-lead wins deals, but most small teams notice a new lead late and reply
hours later — if at all. This offer closes the gap from *"a qualified lead
arrived"* to *"a human-approved, on-brand reply went out, and the lead was
followed up"*, without giving an AI unattended authority to message strangers.

## Two-phase structure (what is real vs. what is built next)

### Phase 1 — Fast, human-approved response  *(mostly real today)*

Built on the existing runtime; this is the part that can be demonstrated now:

1. A lead is captured and deterministically qualified (see the Lead Capture
   offer) — **real today**.
2. A hot lead is held at the durable approval gate; nothing is sent without a
   human decision — **real today**.
3. For an approved lead, the system drafts an on-brand first response for review
   (`internal.content.draft`) — **real today** (deterministic draft).
4. The send itself is a **consequential** step, so it runs only after approval,
   through an injected external-action adapter — **the gate is real; the send
   adapter is deliberately unconfigured today** and must be wired per client.

Deliverable of Phase 1: *every qualified lead gets a reviewed first response
fast, and nothing is ever sent by the AI on its own.*

### Phase 2 — Automated follow-up sequence  *(engineered next, not built)*

Only after Phase 1 is live and trusted:

1. A timed follow-up sequence (e.g. day 1 / day 3 / day 7) for leads that did not
   reply.
2. Suppression rules (stop on reply, on booking, on opt-out, on CRM stage change).
3. Per-step approval policy the client chooses (all-approved, or approve-once then
   automatic).

This requires: a real messaging adapter (email first), a durable schedule, and
consent/opt-out handling. **Not built in this change.**

## What is genuinely executable today (say this honestly)

- Deterministic qualification and the durable hot-lead approval gate.
- `internal.content.draft` producing a draft first response from the objective
  and provided knowledge.
- `external.message.send` declared as a **consequential** tool: it is refused by
  the internal executor and can only run after a human approval through an
  `ExternalActionAdapter`.
- The Operations Assistant agent can plan an `outreach` task and stop at
  `awaiting_approval`, then perform exactly one approved action.
- An **authenticated owner/admin approval surface** in the dashboard: the run
  page shows an Approve/Reject control while a hot lead is held at the gate, and
  the decision runs through the secure server action (session-derived actor,
  owner/admin only, one-shot). Only owners/admins see the control; members see
  the gate status. This is the human step, not the send.

## What is NOT wired yet (be blunt with the client)

- **No message is actually sent.** The production external-action adapter is the
  *unconfigured* one: any attempt fails with `EXTERNAL_ACTION_UNCONFIGURED`. A
  real email/CRM/SMS adapter must be implemented and configured per client.
- **No follow-up timeline.** There is no scheduler for multi-step sequences.
- **No reply detection / suppression** — required before any automated follow-up.
- **No LLM in production by default.** A real model adapter exists
  (`model-provider-openai.ts`) but is used only when `REPLYFLOW_AI_*` is
  configured; the default drafts are deterministic. If the client wants
  AI-authored copy, that is a configured, billed, reviewed step.
- **No unattended sending.** Every consequential step stays behind human approval.

## Safety and trust guarantees (the selling point)

- **Human-in-the-loop:** a hot or high-value lead is never contacted by the AI
  without an explicit approval; approval is one-shot, so a message is sent exactly
  once (a repeat decision is refused).
- **Idempotent delivery:** every outbound attempt carries a stable idempotency
  key, so a retry cannot double-send.
- **Honest failure:** if the send adapter is missing or the provider is down, the
  task fails with an actionable error — it never reports a success it cannot
  prove.
- **Auditable:** every task and state change is written to an append-only event
  log.

## Deployment prerequisites (checklist)

- [ ] Lead capture live (see `lead-capture-production-readiness.md`).
- [ ] A real `ExternalActionAdapter` for the client's channel (email first),
      with idempotency and a dry-run mode.
- [x] An authenticated approval surface for owners/admins — **done**: the run
      page renders an owner/admin-only Approve/Reject control backed by
      `resolveLeadApprovalAction`.
- [ ] Client-approved response templates and tone guidance.
- [ ] Consent / opt-out policy documented and enforced.
- [ ] For AI copy: `REPLYFLOW_AI_*` configured, cost and data-retention agreed.

## Discovery questions

1. How fast do you want a qualified lead to hear back, and who approves it?
2. What does a great first reply look like for your best customer?
3. How many follow-ups, and what should stop a sequence?
4. Which channel first — email, SMS, WhatsApp?
5. What is a "reply" that should pause everything (booking, opt-out, objection)?

## Success metrics

- Median time from lead arrival → approved response sent.
- Share of qualified leads that received a response.
- Reply and meeting-booked rate versus the client's current baseline.
- Zero messages sent without approval; zero duplicate sends.

## What we deliberately do NOT promise

- Unattended cold outreach or spam-adjacent behaviour.
- Deliverability guarantees from a brand-new sending domain.
- Multi-channel orchestration in Phase 1.
- Any result that depends on a live model call before it is configured and paid
  for.
