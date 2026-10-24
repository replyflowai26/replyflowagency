# First Client Demo & Narrow Offer (drafts and scripts only)

> Internal selling and delivery reference. **Do not send messages, contact
> prospects, create accounts or incur costs from this document.** A human runs the
> demo and sends anything outbound. Every claim below maps to something that
> exists and is tested; anything not built is called out as *not built*.

This is the one narrow thing we sell first. It is deliberately small, so it can
be delivered and trusted before we scope anything larger. Pair it with
`lead-capture-service-offer.md` (capability detail), `client-acquisition-readiness.md`
(checklists), and `outreach-drafts.md` (the messages a human sends).

## Ideal customer profile (ICP)

Reach out only when **all** are true:

- A small service business or agency (**2–25 people**) with a real inbound lead
  source: a website form, a landing page, a paid-ad destination, or a DM inbox.
- Leads currently arrive somewhere a human has to **notice manually** (an inbox,
  a shared spreadsheet, a Slack ping) — and speed-to-lead actually matters to
  their revenue.
- The decision-maker is reachable and can approve a small monthly spend without a
  procurement cycle (owner, founder, head of sales).
- They accept that a **human keeps approval** over anything sent back to a lead.

Disqualify (say no, politely) when: they want a full CRM build first, want
guaranteed revenue or lead volume, demand unattended AI sending on day one, have
no inbound lead source, or will not name one channel and one destination.

## Business outcome we sell

**Every inbound lead is captured, scored against your checklist, and the right
person is alerted within seconds — with a human approving anything that goes back
out.** The measurable promise is *speed and zero dropped leads*, not revenue.

- Target: lead arrival → owner alerted in **under 60 seconds**.
- Target: **100%** of captured leads reach the pipeline.
- Target: **zero** unexplained failed runs.

## The narrow offer (one channel, one destination)

For a single inbound channel (one website form **or** one webhook endpoint),
ReplyFlow will:

1. **Capture** the lead payload from that channel.
2. **Normalize & qualify** it deterministically against an agreed short checklist.
3. **Persist** a durable run with an append-only event timeline.
4. **Notify** the owner (and hold high-value/hot leads at a **human approval
   gate** before any outreach).
5. **Deliver** the lead to the one agreed destination when a real adapter is
   configured.

One channel, one qualification rule set, one destination, one notification.

## 5-minute demo script (synthetic data, mock-labelled)

Run `npm run demo:client-capture`. It is **fully local, in-memory, no DB and no
network** — the outbound CRM endpoint is *simulated*. Say that out loud: *"This is
the real orchestration and the real signed HTTP adapter; the CRM on the other end
is a stand-in so nothing leaves this laptop."* The synthetic names (Sam, Dana,
Maria, Bob, Carl) are made up.

| Time | What you say | What you show |
| ---- | ------------ | ------------- |
| 0:00–0:30 | "You lose good leads to a slow first reply. Here's a small setup that fixes only that." | Open with the problem, not the product. |
| 0:30–1:00 | "First, junk is rejected outright." | `[1]` malformed submission → `rejected`, **0 runs written**. |
| 1:00–1:45 | "A normal lead is captured, scored and delivered in one shot." | `[2]` warm lead → `succeeded`, timeline `queued → dispatching → integration_delivered`, provider ref returned. |
| 1:45–2:15 | "The same lead can't be double-handled." | `[3]` resubmission → `duplicate`, **same run id**, still 1 run. |
| 2:15–3:00 | "This is the part you'll care about: a hot lead is not contacted — it waits for you." | `[4]` hot lead → `awaiting_approval`, `approval_state = pending`, timeline stops at `approval_required`, **0 new deliveries**. |
| 3:00–3:45 | "You — or an owner — approve once, and only then does it go out." | `[5]` approve → `succeeded`, `integration_delivered`; `[6]` a **second** approve → `invalid_state` (no double contact). |
| 3:45–4:30 | "When the CRM is flaky, it retries safely; when it's really down, it fails honestly instead of pretending." | `[7]` 503/503/200 → retried, succeeded (3 attempts). `[8]`/`[9]` down/hang → `failed` with `INTEGRATION_DELIVERY_FAILED`, 3 attempts, **no fake success**. |
| 4:30–5:00 | "Everything you just saw is signed and deduplicated, and nothing was sent from this machine." | Delivery report (`delivered: 3 · failed: 2`); sampled request shows `x-replyflow-signature` set and **body does not leak the secret**. |

Close with one question: *"Where do your leads land today, and who's supposed to
notice them?"* Then stop. If they want it, book the setup; if not, no follow-up.

## What is real vs. not (say this plainly if asked)

- **Real today:** capture, validation/normalization, deterministic qualification,
  durable run + event timeline, atomic one-shot approval gate, owner/admin
  dashboard Approve/Reject, HMAC-authenticated inbound endpoint, signed +
  idempotent outbound adapter with timeout/retry/honest failure.
- **Opt-in:** a real CRM delivery only when `REPLYFLOW_CRM_WEBHOOK_URL` +
  `REPLYFLOW_CRM_WEBHOOK_SECRET` are configured for the client's system.
- **Not built:** unattended sending, multi-step follow-up sequences, reply
  detection/suppression, multi-channel campaigns, n8n dispatch for lead runs, and
  a live LLM in production by default.

## Deliverables (included)

- One configured inbound channel and one destination.
- The `lead-capture-qualification` workflow live for that channel.
- Agreed qualification signals and thresholds.
- The dashboard run view (status, event timeline, errors) and the owner/admin
  approval control.
- A short handover note: what's wired, what's mock/unconfigured, and how to
  disable it (unset the intake secret → the endpoint returns `503`).

## Exclusions (not included / not promised)

- No unattended or AI-authored outbound without human approval.
- No multi-step follow-up sequences, reply detection or opt-out handling.
- No multi-channel campaigns, voice or WhatsApp.
- No CRM write-back beyond the single configured destination.
- No deliverability guarantees from a new sending domain.
- No revenue or lead-volume guarantees.

## Follow-up automation (the funded next phase — NOT built)

The service is named *lead capture + fast response + follow-up*, but only the
first two are built and verified. Be explicit:

- **Capture + fast response (built):** capture, qualify, owner alert, and a
  human-approved first response path.
- **Follow-up automation (NOT built):** multi-step timed sequences
  (day 1 / 3 / 7), reply detection, and opt-out/suppression. There is no
  scheduler and no messaging adapter configured; do **not** sell or demo it as
  live. It is scoped and funded as the phase after the first step is trusted.

## Onboarding (deliberate, gated)

1. **Discovery call** — name the single channel, the single destination, the
   qualification signals, and who approves hot leads.
2. **Configuration** — set `REPLYFLOW_LEAD_INTAKE_SECRET`; for real delivery set
   `REPLYFLOW_CRM_WEBHOOK_URL` + `REPLYFLOW_CRM_WEBHOOK_SECRET` against a
   **staging** CRM endpoint first.
3. **Apply the migrations** to the agreed target environment through the reviewed
   path (`lead-capture-migration-preflight.md`) — never as a side effect of a code
   deploy.
4. **Dry-run** — deliver to the staging endpoint and confirm a signed, keyed
   request arrives; verify a hot lead holds at the gate and approves exactly once.
5. **Go-live** — point the inbound channel at the live endpoint; confirm the
   go-live gate in `lead-capture-production-readiness.md`.
6. **Review** — after one week, read the run history together: dropped leads,
   failed runs and root cause, and time-to-alert.

### First-client onboarding checklist (copy into the engagement)

- [ ] **Scope fixed in writing:** one inbound channel, one destination, one
      qualification rule set, one notification target, one approver.
- [ ] **Environment agreed:** the target is a **separate staging project first**;
      production only after staging passes (`staging-environment-setup.md`,
      `lead-capture-migration-preflight.md`).
- [ ] **Migrations applied** to the target through the reviewed path (never as a
      deploy side effect); post-migration structural + authz checks pass.
- [ ] **Secrets set** on the server only: `REPLYFLOW_LEAD_INTAKE_SECRET` (or the
      endpoint returns `503`) and, for real delivery, `REPLYFLOW_CRM_WEBHOOK_URL`
      + `REPLYFLOW_CRM_WEBHOOK_SECRET` against a staging CRM.
- [ ] **Channel wired:** the client's form/endpoint POSTs the signed envelope to
      `/api/automation/leads`; a test lead returns `202`/created.
- [ ] **Dry-run passes:** delivery is signed + keyed; a hot lead holds at the gate
      with 0 deliveries; approve fires exactly once; a duplicate is de-duplicated.
- [ ] **Approver trained:** the owner/admin knows where the Approve/Reject control
      is and the expected response time.
- [ ] **Rollback understood:** unset the intake secret → endpoint returns `503`.
- [ ] **Success criteria shared** (below) and the review date booked.

## Success criteria (how we both know it worked)

- 100% of captured leads appear in the pipeline; none silently dropped.
- Median lead-arrival → owner-alert time **under 60 seconds**.
- Zero unexplained failed runs; every failure has an `error_code`.
- Zero messages sent without approval; zero duplicate deliveries.
- One client quote describing a real saved lead.

## Prospect qualification rubric (score before a human sends any draft)

Score each criterion 0 / partial / full. Total out of 100:

| Criterion | Full | Partial | Notes |
| --- | --- | --- | --- |
| Names one real inbound channel (form / ads / DM / phone) | 25 | 10 | "leads come from everywhere" = partial at best |
| Feels the speed-to-lead problem (or admits late noticing) | 20 | 8 | stated pain, not inferred |
| Reachable decision-maker (owner / founder / head of sales) | 20 | 8 | a gatekeeper-only contact caps this |
| Accepts a human approving outbound | 15 | 0 | binary: yes or disqualified |
| Small team, fits ICP (2–25 people) | 10 | 4 | — |
| Can approve a small monthly spend without procurement | 10 | 3 | — |

**Threshold:** pursue when total **≥ 60** and no hard disqualifier below.
Disqualify outright (do not score) if any of:

- Wants a full CRM build first.
- Demands unattended AI sending on day one.
- Requires guarantees on revenue or lead volume.
- Has no inbound lead source, or will not name one channel + one destination.
- Will not accept human approval over anything sent to a lead.

Record the score in `client-lead-tracker.md` (`score` column; `qualified` = `qualified` at ≥ 60).
