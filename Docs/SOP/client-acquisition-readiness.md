# Client Acquisition Readiness

> Operational checklist only. Do **not** send messages, contact prospects, create
> accounts or incur costs as part of working this document. It prepares the offer;
> a human sends anything outbound.

## The one narrow initial offer

**Inbound Lead Capture & Instant Follow-up** — for a single inbound channel
(a website form or a webhook endpoint).

Given a lead, ReplyFlow will:

1. Capture the lead payload from the inbound channel.
2. Store it in the client pipeline.
3. Qualify/score it against a short agreed checklist.
4. Notify the owner (or an approval-gated follow-up step).

One channel, one destination, one notification. Nothing more.

## Why this is deliverable today

This offer maps exactly to capabilities that already exist and are tested. The
verified slice is the **synchronous lead-capture orchestrator**, not an n8n run:

- **Capture:** `POST /api/automation/leads`, HMAC-SHA256 signed
  (`x-replyflow-signature`), 32 KB body cap, IP rate limited, `503` when the
  secret is unset — `src/app/api/automation/leads/route.ts`.
- **Qualify + record:** deterministic scoring, then a durable `workflow_runs` row
  + append-only event timeline, written through the atomic transition RPC
  (`src/lib/automation/lead-capture-run.ts`).
- **Deliver or gate:** the outbound CRM step uses the signed HTTP adapter when
  `REPLYFLOW_CRM_WEBHOOK_URL` + `_SECRET` are set; a **hot** lead is held at a
  durable `approval_state = 'pending'` gate instead.
- **Human approval:** owner/admin Approve/Reject on the run page
  (`src/app/dashboard/projects/[id]/runs/[runId]/lead-approval-controls.tsx`).
- **Visibility:** run history + event timeline in the dashboard, plus the client
  pipeline.

**Explicitly not built** (do not demo or imply it): n8n dispatch for lead runs
(runs execute synchronously), unattended sending, multi-step follow-up sequences
and reply detection. See `lead-capture-production-readiness.md` §7.

No new integrations are required to demonstrate the slice; the local demo runs
entirely in-memory with a **mock** CRM endpoint.

## What we deliberately do NOT promise yet

- No outbound multi-channel campaigns, voice, or WhatsApp automation.
- No CRM write-back beyond what a single n8n workflow mapping is configured to do.
- No unattended AI decisions — approval gates stay human-in-the-loop.
- Nothing that requires credentials beyond a reference inserted by the client.

## Demo readiness checklist

- [ ] `npm run demo:client-capture` runs green (in-memory, mock CRM, no network).
- [ ] The 5-minute script in `first-client-demo-and-offer.md` is rehearsed end to
      end and the mock-labelling line is said out loud.
- [ ] `npm run test:bridge` is green (`365/365` at time of writing).
- [ ] A signed sample request is shown with `x-replyflow-signature` set and the
      body **not** leaking the secret.
- [ ] The hot lead visibly stops at `approval_state = 'pending'` with **0
      deliveries**, and a second approve returns `invalid_state`.
- [ ] For a real delivery demo only: a **staging** CRM endpoint +
      `REPLYFLOW_CRM_WEBHOOK_SECRET` are configured (otherwise it stays mock).

## Outbound checklist (human-executed, manual)

- [ ] Target list is limited to businesses with a real inbound lead source.
- [ ] Outreach copy names the single channel and the single promised outcome.
- [ ] A booking link and a 10-minute demo script exist.
- [ ] One reference case study or a trustworthy pilot is ready to cite.
- [ ] Pricing for the narrow offer is fixed before the first call.

## Discovery questions

1. Where do inbound leads arrive today (form, ad, DM, phone)?
2. Who currently notices a new lead, and how fast?
3. What makes a lead "worth a human's time"?
4. Who should be notified, and through which channel?
5. What is one bad outcome we must avoid (spam, wrong contact, duplicates)?

## Success metrics / proof to collect

- Time from lead arrival → owner notified (target: under 60 seconds).
- Percentage of captured leads that reach the pipeline (target: 100%).
- Number of failed runs and their root cause (target: zero unexplained).
- One client quote describing a real saved lead.

## Disqualifiers

- Wants a full CRM build in the first engagement.
- Needs live credentials immediately without a reference/vault.
- Requires guarantees on revenue or lead volume.
- Has no inbound lead source to automate.
