# Outreach Execution Pack — Top 3 (prepared, NOT sent)

> **Nothing in this file has been sent.** It is the send-ready pack for the three
> highest-scoring prospects from `prospect-research-and-pipeline.md`. A human
> CEO reviews and approves the **specific message text** before anything goes out.
> Evidence, scores and form URLs below are copied from the research doc, not
> invented.

## Selection (from existing evidence — no new research)

Sorted by existing `score`, then by response-time-promise specificity. Four
prospects tie at 95; P-004 is listed 4th because its wording is hedged
("usually", "often") versus a firm SLA.

| Rank | ID | Company | Score | Verified evidence (verbatim, from research doc) | Contact route (public form) |
| --- | --- | --- | --- | --- | --- |
| 1 | P-001 | Austin Roofer | 95 | "we'll get back to you within 1 business hour" | https://austinroofer.com/contact |
| 2 | P-002 | RISE Roofing Austin | 95 | "We respond within 24 hours" | https://www.riseroofingaustin.com/contact-us/ |
| 3 | P-003 | Pearson Family Roofing | 95 | "We answer our phone live, and can usually schedule an appointment for within one business day - often sooner." | https://pearsonfamilyroofing.com/request-a-quote/ |
| 4 (next) | P-004 | Everest Mechanical | 95 | "usually the same day" (hedged) | https://ac-austin.com/quote.html |

Website sources: `austinroofer.com` · `riseroofingaustin.com` ·
`pearsonfamilyroofing.com`. Contact route for each is the company's **own public
form** — no scraped emails, no phone harvesting.

## The pilot offered in every message (shared, honest)

- **Scope:** one inbound channel → one destination. Capture, validate, score
  against their checklist, durable record + timeline, owner alert, human
  approval gate for hot leads.
- **Timeline:** 2 weeks — week 1 configure + dry-run, week 2 live + review.
- **Required access from them:** the one form/endpoint, the destination
  (CRM/webhook) they want leads delivered to, their qualification checklist, and
  a named owner/admin approver.
- **Acceptance criteria (pilot targets, measured in week 2 — not live guarantees
  today):** a test lead appears in under 60 seconds; a hot lead
  is not contacted before approval and delivers exactly once; a duplicate never
  creates a second record; every failure shows a clear reason.
- **CRM delivery caveat (say plainly):** delivering into *their* CRM depends on
  confirming their system and endpoint and setting up a signed connection for
  it — that is part of the pilot, not something already integrated. The demo
  they will see runs on a **mock CRM endpoint on my laptop; nothing is sent**.
- **Not offered:** guaranteed revenue, unattended/AI-authored sending,
  multi-step follow-up sequences, or integrations that are not built.

## Approval gate (rule)

- [ ] CEO edits/approves the **exact** message text for a specific prospect.
- [ ] Only then may a human send it via that prospect's public form.
- [ ] Tracker row moves `draft_pending_approval` → `approved_to_send` →
      `contacted` (with `contact_date`).
- **No sending without per-message CEO approval. No automated form submission.**

## Follow-up schedule (polite, compliant, max 3 touches)

| Touch | When | Content |
| --- | --- | --- |
| 1 | Day 0 (after approval) | First message below |
| 2 | +3 business days | One short follow-up (Draft 2 in `outreach-drafts.md`) |
| 3 | +7 business days | One final close-the-loop (Draft 6 in `outreach-drafts.md`) |
| — | After touch 3 | **Stop.** Mark `lost` / `nurture`. Never more. |

**Hard stops:** any decline, "not interested", or opt-out → stop immediately,
mark `lost` with the reason, and do not contact again. Never reply to an opt-out.
No attachments, no tracking pixels, no purchased lists, max 3 touches total.

---

## P-001 — Austin Roofer

**Contact route (Task 21, verified public channel):** email **info@austinroofer.com**
(general business inbox published on https://austinroofer.com/contact and the site
footer; secondary: phone (512) 764-3547). Source URL: https://austinroofer.com/contact.
The **estimate form must not be used** to submit a sales pitch (it is a homeowner
intake form) — send the email version only. **Evidence (verified live 2026-10-16,
Task 19):** the contact page says a reply comes "within 1 business hour" ("within
one business hour during working hours"), while the **homepage hero form** says
"We'll call you within **30 minutes**." These are two *different* published times;
treat neither as a guaranteed operating SLA.

**Why this may fit (hypothesis — not a fact):** they advertise a very fast first
touch (30 min on the homepage, 1 business hour on the contact page), which is
hard to keep by hand outside working hours — so an overnight or mid-job form
request may be answered later than advertised. Stated as a question, not a
claim about how they actually operate. To be confirmed on the call.

**Claims requiring confirmation before sending the email version:** that a named
decision-maker is reachable; that the fast-response promise applies to web-form
leads (not only calls); and which of the two published times is the real target.
If unconfirmed, send the short form version only.

**Contact-form message (short — fits a form's message field):** *(finalized
2026-10-16, Task 20: the "in about a minute" response-time claim removed and the
integration described as a pilot to configure, not a live CRM hookup; pending CEO
wording approval. **Not usable for P-001** — Task 21 confirmed the estimate form
is a homeowner intake form and must not carry a sales pitch; kept here for
reference only.)*

> Hi — quick question, and no pitch if it isn't useful. Your homepage says you'll
> call within 30 minutes, and your estimate page says you reply within one
> business hour — that's fast, and it suggests every web request is watched
> closely. I'm curious how requests that land overnight or mid-job reach a
> person. I'm building a small setup for roofing businesses: it captures each
> estimate request, scores it against a short checklist you define, and flags the
> right person, with a human approving anything that goes back out. It's a pilot
> we'd configure on your system — not a live integration yet. If a more
> consistent first touch is ever useful, I'd be glad to show it in 10 minutes.
> If not, no follow-up.

**Email version (P-001's send vehicle — to the published inbox info@austinroofer.com; no named contact is required):**

> Subject: Question about your roofing lead follow-up process
>
> *(As sent. The drafted subject was `your "1 business hour" promise — quick
> question`; the CEO sent the subject above instead — as-sent is authoritative.)*
>
> Hi — your contact page promises a reply "within 1 business hour." That's a
> strong promise to keep manually when requests arrive overnight.
>
> I build a small setup for roofing businesses: every estimate request is
> captured, scored against a short checklist you define, and flagged to the right
> person. Anything going back out waits for a human to approve it — no unattended
> sending.
>
> Pilot: one channel, one destination, two weeks. Week 1 configure + dry-run,
> week 2 live + a short review. Acceptance is simple: a test lead in under 60
> seconds (the pilot's target, measured in week 2), a duplicate never creates a
> second record, and every failure shows a clear reason.
>
> Honest caveat: delivering into your CRM depends on confirming your system and
> endpoint and wiring a signed connection — that's part of the pilot, not
> something already integrated. The demo runs on a mock endpoint on my laptop;
> nothing is sent.
>
> Worth 10 minutes?

> **Sent / approval note (as-sent is authoritative):** the CEO sent this initial
> email on **2026-10-17 15:07 local** to info@austinroofer.com with the subject
> **"Question about your roofing lead follow-up process"**. This sign-off covers
> **the initial email only**. The follow-up below is a **separate message** and
> needs its **own** CEO approval before it is sent — it is **not yet approved**.

**Follow-up (tailored from `outreach-drafts.md` Draft 2 — send once on
2026-10-21 if no reply; not sent):**

> Subject: re: Question about your roofing lead follow-up process
>
> Hi — following up once on my note from the 17th. If a slow first reply isn't a
> real problem for you, ignore this and I'll stop.
>
> If it is: I set up capture + qualification + an owner alert for a single
> inbound channel, and you keep approval over anything that goes back out. Glad
> to show the dashboard view of a lead moving from captured to approved — no
> obligation.
>
> Open to a short call this week, or should I close the loop?
>
> *(Draft only — a human sends this. NOT sent. Reply to the first email is still
> pending.)*

## P-002 — RISE Roofing Austin

**Contact route:** https://www.riseroofingaustin.com/contact-us/ ·
**Evidence:** "We respond within 24 hours" + a free 10-minute video/voice call
booking.

**Why this may fit (hypothesis — not a fact):** a published 24-hour SLA plus a
self-serve booking link suggests leads arrive through the page and are handled
manually; during storm surges the SLA plausibly slips. To be confirmed.

**Claims requiring confirmation before sending the email version:** that the
24-hour promise covers the web form; that an owner (not a call centre) reviews
form leads. If unconfirmed, send the short form version only.

**Contact-form message:**

> Hi — your contact page promises a response "within 24 hours" and books a
> 10-minute call right there. Quick question: when those requests come in after
> hours or during a storm rush, is the 24-hour promise easy to keep? I build the
> piece in front of that — every form submission captured, scored against your
> checklist, and the owner alerted in seconds, with a human approving anything
> that goes back out. One channel, one destination, two-week pilot. Want me to
> show it on your form?

**Email version:**

> Subject: your 24-hour response promise
>
> Hi — I noticed your contact page commits to a response "within 24 hours," and
> even books a 10-minute call on the spot. That's a great promise; it's also the
> kind that breaks quietly when requests arrive overnight or during storm week.
>
> I build a small setup that captures every form submission, scores it against a
> short checklist you define, and alerts the right person in seconds. Nothing
> goes back to a homeowner without a human approving it.
>
> Pilot: one channel, one destination, two weeks (configure + dry-run, then live
> + review). You'd need to give me the one form, the destination you want leads
> in, your checklist, and a named approver. Acceptance: a test lead in under 60
> seconds, hot leads held until approved and delivered exactly once, duplicates
> blocked, failures explained.
>
> Caveat up front: pushing leads into your CRM depends on confirming your system
> and endpoint and wiring a signed connection for it — part of the pilot, not an
> existing integration. The demo runs on a mock endpoint on my laptop; nothing
> actually sends.
>
> Open to 10 minutes?

## P-003 — Pearson Family Roofing

**Contact route:** https://pearsonfamilyroofing.com/request-a-quote/ ·
**Evidence:** "We answer our phone live, and can usually schedule an appointment
for within one business day - often sooner."

**Why this may fit (hypothesis — not a fact):** the site already values
responsiveness (live answering, one-business-day scheduling), so a web-form lead
that arrives after hours is plausibly the weak spot. To be confirmed.

**Claims requiring confirmation before sending the email version:** that quote
requests arrive via the web form (not only phone); that a named owner is
reachable. If unconfirmed, send the short form version only.

**Contact-form message:**

> Hi — your site says you "answer our phone live" and usually schedule within
> one business day. That's a real differentiator; it's also the part that a web
> form can quietly undo after 5pm. Quick question: do quote requests that come in
> overnight get seen as fast as a phone call? I build a small setup that captures
> those requests, scores them against your checklist, and alerts the right person
> in under a minute — with a human approving anything that goes back out. One
> channel, one destination, two-week pilot. Worth a short call?

**Email version:**

> Subject: "we answer our phone live" — the part the web form can undo
>
> Hi — your site promises you "answer our phone live" and usually schedule
> within one business day. That's a genuine edge, and it's exactly what a web
> form can quietly undo after hours.
>
> I build a small setup for roofing businesses: every quote request is captured,
> scored against a short checklist you define, and the right person is alerted in
> under a minute. A human approves anything that goes back out — no autonomous
> sending.
>
> Pilot: one channel, one destination, two weeks. You'd give me the one form, the
> destination, your checklist, and a named approver. Acceptance: a test lead in
> under 60 seconds, a duplicate never creates a second record, hot leads held
> until approved and delivered exactly once, failures shown with a clear reason.
>
> Honest caveat: delivering into your CRM depends on confirming your system and
> endpoint and wiring a signed connection — part of the pilot, not an existing
> integration. The demo runs on a mock endpoint on my laptop; nothing is sent.
>
> Worth a short call?

## CEO review & sign-off (the packet decision)

A human CEO reviews this pack and signs off on the **exact** text per prospect.
Nothing is sent until the matching row is approved. **P-001's initial email is the
only approved-and-sent row; every other row and every follow-up is not yet
approved.**

| ID | Evidence confirmed | Form verified live | Draft chosen | Claims confirmed | Approved (Y/N) | Approver | Date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P-001 Austin Roofer — initial email | ☑ (Task 19) | ☑ (fetched live, not submitted) | ☐ short ☑ email | n/a (stated as a question) | **Y** | CEO | 2026-10-17 |
| P-001 Austin Roofer — follow-up (2026-10-21) | ☑ | n/a | ☑ follow-up | ☐ | **N** | — | — |
| P-002 RISE Roofing | ☐ | ☐ | ☐ short ☐ email | ☐ | **N** | — | — |
| P-003 Pearson Family Roofing | ☐ | ☐ | ☐ short ☐ email | ☐ | **N** | — | — |

> **Task 20 note:** P-001's message was finalized on 2026-10-16 (removed the
> "about a minute" response-time claim; described CRM delivery as a pilot to
> configure, not a live integration). **Task 21 note:** the send vehicle changed
> from the estimate form to **email to info@austinroofer.com** (the form is a
> homeowner intake form and must not carry a sales pitch). **Task 24 note:** the
> CEO manually sent this exact email on **2026-10-17 15:07 local** (confirmed in
> the Sent folder); subject "Question about your roofing lead follow-up
> process." Recorded in `client-lead-tracker.md` as `sent` / `contacted`, reply
> pending, follow-up due **2026-10-21**. **Task 26 note:** the email draft subject
> above was corrected to the **as-sent** subject, and the sign-off table now lists
> the **initial email** separately from the **follow-up** (a distinct message,
> **not approved** — pending its own CEO sign-off). P-002/P-003 remain unapproved
> (N) and uncontacted.

Sign-off is **per message**, not per prospect list. Approving one row does not
approve another, and does not authorise later follow-ups — the follow-up drafts
are re-checked against the same rule before sending.

## What a human must do before sending (nothing here is automatic)

1. Confirm the prospect's **verified public channel** above (email or phone for a
   B2B intro; a homeowner intake/estimate form must **never** carry a sales
   pitch).
2. Choose the short (form) or long (email) version — whichever matches a channel
   you are actually allowed to use — and edit the tone to sound like them; keep
   every factual claim intact.
3. Get CEO approval on the **exact** text → send via that allowed channel.
4. Update the tracker row: `draft_status = approved_to_send`, then
   `contacted` + `contact_date` + `last_touch` + `next_follow_up`.
