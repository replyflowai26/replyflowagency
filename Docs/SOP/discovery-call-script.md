# Discovery Call Script, Checklist & Onboarding Form

> Internal sales tooling. A human runs the call and fills the form. **Do not
> create accounts, contact prospects, or promise anything not in
> `first-client-demo-and-offer.md`.** Claims stay limited to: capture,
> qualification, owner alert, run visibility, and the human approval gate.

Pair with `first-client-one-pager.md` (what you send after) and
`outreach-drafts.md` (how they heard from you).

## Discovery checklist (tick BEFORE the call)

- [ ] Matches the ICP: 2–25 person service business/agency with a real inbound
      lead source.
- [ ] Named a channel when we contacted them (form / ads / DM / phone).
- [ ] Scored ≥ 60 on the rubric in `first-client-demo-and-offer.md`; no hard
      disqualifier.
- [ ] Has a reachable decision-maker (owner / founder / head of sales).
- [ ] Accepts a human approving anything that goes back to a lead.
- [ ] The demo is loaded: `npm run demo:client-capture` runs green locally.

## 20-minute discovery-call script

| Time | What you say | What you do |
| --- | --- | --- |
| 0:00–2:00 | "Thanks for the time — I'll keep this to 20 minutes. If it's not a fit, I'll say so." | Set the frame and the length. |
| 2:00–6:00 | "Where do inbound leads actually land today? Who notices a new one, and how fast?" | Listen. Do not pitch yet. Write down the channel and the person. |
| 6:00–9:00 | "What makes a lead worth a human's time? And what's the worst that can happen if one sits for a day?" | Turn their answer into the qualification checklist. |
| 9:00–14:00 | "Mind if I show you the exact thing — it's running locally, nothing leaves this laptop?" | Run `npm run demo:client-capture`. Say the mock labelling line out loud. |
| 14:00–17:00 | "Here's the pilot: one channel, one destination, two weeks. You approve anything that goes out." | Name the pilot, the prerequisites and the acceptance criteria from the one-pager. |
| 17:00–20:00 | "What would stop this from being obvious to say yes to?" | Surface the objection. If it's scope, use the honest-scope reply (Draft 4). If it's price, hold the fixed pilot price. |

**Close with one of three outcomes, and say it out loud:**
1. "I'll send the one-pager and a pilot proposal today — who approves it?"
2. "Not a fit — I'll leave you alone. Good luck." (and actually stop)
3. "Let me think" → set a specific follow-up date and put it in the tracker.

## Must-ask questions (get evidence for every one)

Write the answer verbatim; these become the pilot's config inputs, not opinions.

| Topic | Ask | Why it matters for delivery |
| --- | --- | --- |
| **Lead volume** | "Roughly how many inbound leads a week, and what share come through the form?" | Sizes the value and confirms the channel is the real one. |
| **Response delay** | "What's a typical time from lead arriving to a human replying — fastest and worst case?" | The pain the pilot fixes; compare to their stated SLA. |
| **Current tools** | "What do you use today for the form, the inbox, and the CRM/pipeline?" | Tells us the destination and whether a real CRM adapter is needed. |
| **Workflow ownership** | "Who owns this process day to day — who would set it up and who'd raise a problem?" | Identifies the operational owner vs the approver. |
| **Success criteria** | "If this worked, what would you measure to call it a win?" | Becomes the acceptance criteria; keep it about speed + capture, not revenue. |
| **Access prerequisites** | "Do you have (or can you name) a staging/test endpoint, and who can approve wiring the form to it?" | Confirms we can dry-run before live; nothing is wired without this. |

If any answer is "we don't know", treat the pilot as not-ready and agree a date to
find out — do not proceed to proposal on assumptions.

## Onboarding form (collect before any configuration)

Nothing here is a secret you should send over email; mark anything sensitive for
the client to enter in their own environment.

| Field | Required | Notes |
| --- | --- | --- |
| Company / organization name | yes | — |
| Niche (trade / vertical) | yes | e.g. plumbing, dental, legal |
| Inbound channel type | yes | `form` / `ads` / `dm` / `phone` |
| Channel destination (where the lead POSTs to) | yes | one endpoint only |
| Destination for delivered leads | yes | the one CRM/webhook we deliver to |
| Qualification checklist + thresholds | yes | convert their "worth a human's time" answer into signals |
| Approver name + role (owner/admin) | yes | must be an owner/admin to approve hot leads |
| Expected response time for an approver | yes | sets the alert SLA |
| Data retention expectations | yes | what PII is stored, for how long |
| Staging environment ready? | yes | must be `yes` before go-live (see `staging-environment-setup.md`) |
| Client CRM endpoint + signing secret | only if real delivery | client enters these; we never hold their secret |
| Named technical contact | optional | for channel wiring questions |

## After the call

- [ ] Add/update the prospect row in `client-lead-tracker.md` (status, niche,
      pain point, last touch, next follow-up).
- [ ] Send the one-pager + pilot proposal (`pilot-proposal-template.md`) if
      outcome 1.
- [ ] If outcome 3, book the follow-up in the tracker with a dated next action.
