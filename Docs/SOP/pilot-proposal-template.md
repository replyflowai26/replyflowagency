# Pilot Proposal Template — Inbound Lead Capture (2 weeks)

> Internal template. A human adapts and sends it. **Do not send from this file.**
> Fill every `[ ]`; delete anything that does not apply. Never state a price,
> result, testimonial or integration you have not actually verified. Pricing is a
> human's decision — leave the placeholder until they set it.

---

**To:** [company] — [contact_role]
**From:** [our name] · [date] · **Valid for:** 14 days

## 1. Outcome

Every inbound lead arriving through **one** channel is captured, scored against
your checklist, and your named approver is alerted in **under 60 seconds**. Hot
leads are held until a human approves. Nothing is sent to a lead without that
approval.

## 2. Scope (what we build)

- Configure capture for **one** inbound channel: [channel — form / ads / DM /
  phone] → [endpoint URL].
- Wire **one** delivery destination: [destination name].
- Apply **your** qualification checklist: [list the agreed signals + thresholds].
- Enable the human approval gate for hot leads, approver: [approver name, role].
- Provide the run dashboard (status, event timeline, failure reason) and the
  Approve/Reject control.

Out of scope is listed in §6 — please read it.

## 3. Prerequisites (yours and ours)

| Who | Prerequisite |
| --- | --- |
| Client | One inbound channel and its destination URL |
| Client | Agreed qualification checklist + thresholds |
| Client | A named owner/admin approver and their response time |
| Client | A staging CRM endpoint + signing secret for the dry-run (you hold the secret; we never do) |
| Us | A dedicated **staging** environment, migrations applied through the reviewed preflight path, and a passing dry-run before any live traffic |

If a prerequisite is missing at kickoff, the timeline shifts — we will not go
live against an unverified environment.

## 4. Delivery timeline (2 weeks)

- **Week 1 — configure + dry-run:** channel wired to staging, test lead captured,
  hot lead held and approved exactly once, signed delivery confirmed on the
  staging endpoint, duplicate refused.
- **Week 2 — go live + review:** point the channel at the live endpoint, confirm
  the acceptance criteria below, then a 30-minute review of the run history
  (dropped leads, failures and root cause, time-to-alert).

## 5. Acceptance criteria (how we both know it worked)

- [ ] A test lead appears in under 60 seconds of arrival.
- [ ] **100%** of captured leads reach the pipeline; none silently dropped.
- [ ] A hot lead is **not** contacted before approval; approval delivers exactly
      once; a second decision is refused.
- [ ] A duplicate submission creates no second record and no second delivery.
- [ ] Every failure shows a clear reason (no silent errors).
- [ ] No message is sent without an approval.

## 6. Exclusions (not included)

Unattended or AI-authored sending · multi-step follow-up sequences · reply
detection and opt-out handling · multi-channel campaigns (voice/WhatsApp) · CRM
rebuild or write-back beyond the one destination · deliverability guarantees from
a new sending domain · any revenue or lead-volume guarantee.

## 7. Support boundary

- **We own:** configuration, capture/qualification logic, delivery and its failure
  reasons, the approval gate, and fixing defects in the above during the pilot.
- **You own:** the inbound channel, the destination's availability, the approver's
  response time, and the accuracy of the checklist you define.
- **Escalation:** one named technical contact on each side; response within one
  business day during the pilot.

## 8. Commercial

Fixed pilot fee: **[price]** · covers the 2-week pilot above.
Ongoing monthly: **[price]** after the pilot, cancel with 30 days' notice.
Payment terms: **[terms]**.

## 9. Acceptance

Reply to this message with "approved" from an owner/admin, plus the §3
prerequisites, and we schedule the kickoff.

[our name] · [contact]
