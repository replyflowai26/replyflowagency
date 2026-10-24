# Outreach Drafts — Inbound Lead Capture (drafts only)

> **Drafts only. Do not send anything from this document.** A human adapts and
> sends every message, and owns the claims made. Nothing here creates an account,
> contacts a prospect, or incurs cost. Keep the claims honest: the product
> captures, qualifies and holds a lead at a human approval gate — it does **not**
> send messages unattended, and no message is sent unless you wire and configure a
> real adapter.

Pair these with `client-acquisition-readiness.md` (the narrow offer) and
`lead-response-followup-offer.md` (the follow-on scope).

## Guardrails (read before using any draft)

- Claim only: capture, storage, qualification, owner notification, run/event
  visibility, and the human approval gate.
- Do **not** claim: unattended sending, deliverability, revenue/lead-volume
  results, multi-channel campaigns, or AI-authored copy by default.
- One channel, one destination, one notification. Do not imply more.
- If asked "does it reply automatically?" answer honestly: today a human approves;
  sending is a configured next step per client.

## Personalization fields (fill these before adapting a draft)

Populate from `client-lead-tracker.md`; only use facts you already know and can
defend. No scraping — a human supplies each field.

| Placeholder | Source | Example |
| --- | --- | --- |
| `{name}` | prospect's first name | `Dana` |
| `{company}` | their business name | `Northline Plumbing` |
| `{channel}` | their `channel` column (`form`/`ads`/`dm`/`phone`) | `their website form` |
| `{outcome}` | the one thing the narrow offer fixes for them | `a missed quote because nobody saw the form until Tuesday` |
| `{approver}` | their named approver (`contact_role`) | `you` |

Rule: one channel, one outcome, one ask. Personalize the *outcome*, not the
promise. If `{outcome}` is empty, do not send — they are not qualified yet.

## Draft 1 — first touch (email)

Subject: your inbound leads, answered faster

Hi {name} — quick question. When a lead comes in through {channel},
how fast does someone actually notice it?

Most small teams I talk to lose the good ones to a slow first reply. I build a
small setup that catches every inbound lead, scores it against a short checklist
you define, and pings the right person within seconds — with {approver} approving
anything that goes back out. One channel, one destination, nothing spammy.

If it's useful, I can show it working on your form in a 10-minute call. If not,
no follow-up from me.

{Draft only — a human sends this.}

## Draft 2 — follow-up (email, ~3 business days later)

Subject: re: your inbound leads, answered faster

Hi {name} — following up once. If a slow first reply isn't a real problem for you,
ignore this and I'll stop.

If it is: I can set up capture + qualification + an owner alert for a single
inbound channel, and you keep approval over anything that goes out. Happy to show
the dashboard view of a lead moving from captured to approved.

Open to a short call this week, or should I close the loop?

{Draft only — a human sends this.}

## Draft 3 — discovery-call opener (say it, don't send it)

> "Here's the narrow thing I do: one inbound channel, one destination. Every lead
> gets captured, scored against your checklist, and the right person gets alerted.
> Anything that goes back to the lead is approved by a human first — I don't turn
> an AI loose on your prospects. Want to see it on your own form?"

## Draft 4 — honest scope reply (when they ask for more)

> "That's the next phase, not this one. Today: capture, qualify, notify, approve.
> Sending automatically and multi-step follow-ups are real work I'd scope after
> this is live and you trust it. I'd rather under-promise and ship the first step."

## Draft 5 — meeting request (calendar link, after a reply)

Subject: re: your inbound leads — 10 minutes?

Hi {name} — glad this landed. Two options:

- **10-minute demo** — I run the capture flow on a stand-in so you can see a lead
  move from captured → qualified → approved → delivered. Nothing leaves my
  laptop; I'll say that out loud.
- **20-minute discovery** — you tell me where leads land today and who notices
  them, and I'll tell you straight whether this fits.

I keep both to the time I promise. Pick a slot that works:
[your booking link]

{Draft only — a human sends this.}

## Draft 6 — final close-the-loop (last touch, ~+7 business days)

Subject: closing the loop

Hi {name} — last note from me. I don't want to keep landing in your inbox, so
I'll close the loop either way:

- If a faster first reply to {channel} leads isn't a priority right now, no
  problem — reply "no" (or nothing) and I'll leave you alone.
- If it is, I can show the capture → qualify → alert flow in 10 minutes, with a
  human approving anything that goes back out.

Either way, thanks for the time.

{Draft only — a human sends this. If they decline or opt out, stop immediately —
do not reply again.}

## Qualification gate before sending any draft

- [ ] They have a real inbound lead source (form, ad, DM, phone).
- [ ] They feel the speed-to-lead problem or admit they notice leads late.
- [ ] They are fine with a human approving outbound.
- [ ] They are not asking for a full CRM or guaranteed revenue.
