# Client Lead Tracker (lightweight)

> Internal working format. Keep it in a spreadsheet, a Notion table, or a plain
> markdown file. It tracks **prospects** and **delivery**, not lead PII. Do not
> store prospect contact details you are not licensed to hold; do not paste real
> leads from a client's system here.

One row per prospect in the first-client sprint. Keep it deliberately small.

> **Researched prospects:** the researched pipeline (procedure, scoring rubric,
> 10 verified Austin-metro businesses with source URLs, evidence snippets and
> draft first messages) lives in `prospect-research-and-pipeline.md`. Copy rows
> from there into this tracker as they progress; do not duplicate research here.

## Columns

| Column | Type | Values / notes |
| --- | --- | --- |
| `id` | text | `P-001`, `P-002`, … stable |
| `company` | text | prospect business name |
| `niche` | text | their vertical/trade — e.g. `plumbing`, `dental`, `legal` |
| `source_url` | url | the research source page (`prospect-research-and-pipeline.md`) |
| `contact_route` | text | the public route used to reach them — a form URL or a **published** business inbox (e.g. `info@`); never a scraped or personal address |
| `contact_role` | text | owner / founder / head of sales (the approver) |
| `channel` | text | their single inbound lead source: `form` / `ads` / `dm` / `phone` |
| `pain_point` | text | one line in their words — e.g. `leads noticed a day late` |
| `score` | number | rubric total out of 100 (`first-client-demo-and-offer.md`) |
| `qualified` | enum | `qualified` / `nurture` / `disqualified` |
| `draft_status` | enum | `none` → `draft_pending_approval` → `approved_to_send` → `sent` |
| `human_approved` | date | date the CEO approved the **exact** message (blank = do not send) |
| `status` | enum | `new` → `contacted` → `replied` → `demo_booked` → `demo_done` → `proposal` → `won` / `lost` |
| `contact_date` | date | date the approved message was sent (blank until sent) |
| `reply` | enum | `none` / `positive` / `declined` / `opted_out` |
| `last_touch` | date | date of the last human-sent message or call |
| `next_follow_up` | date | `last_touch` + 3 business days (max 3 touches; stop on decline/opt-out) |
| `discovery_outcome` | text | one line: fit / not-a-fit / needs-nurture (blank until the call) |
| `pilot_status` | enum | `none` → `proposed` → `agreed` → `configuring` → `live` → `reviewed` |
| `next_action` | text | the one next step, or `none` |
| `owner` | text | the human responsible |
| `notes` | text | one line; no PII dumps |

Example row (synthetic, not a real prospect — note the `EX-` id, so it cannot
collide with a real `P-00n`):

```
EX-001 | Northline Plumbing | plumbing | northline.example/quote | northline.example/contact | owner | form | leads noticed a day late | 75 | qualified | draft_pending_approval | (blank) | new | (blank) | none | (blank) | (blank) | (blank) | none | approve draft text | AE | owner answers own inbox
```

## Real prospect rows (verified facts only — never pre-fill a send)

### P-001 — Austin Roofer

```
P-001 | Austin Roofer | roofing | https://austinroofer.com/contact | email: info@austinroofer.com | (blank) | form | advertised first-touch times (30-min homepage / 1-business-hour contact) are hard to hold outside working hours — unconfirmed | 95 | qualified | sent | 2026-10-17 | contacted | 2026-10-17 | none | 2026-10-17 | 2026-10-21 | (blank) | none | Follow-up is a separate message, NOT yet approved — if no reply, get CEO sign-off then send once on 2026-10-21; stop on any decline/opt-out. | (blank) | Sent 2026-10-17 15:07 local by CEO to info@austinroofer.com; subject: "Question about your roofing lead follow-up process" (confirmed in Sent folder; `human_approved` = send date, 2026-10-17). `reply = none` means reply **pending** — no reply or conversion yet. Follow-up approval: none yet. Email channel set 2026-10-16 (Task 21); estimate form must not carry a sales pitch.
```

## Sending rule (non-negotiable)

**No message is sent until the human CEO approves the specific message text**
(`human_approved` is set). The tracker records the evidence, the route and the
approval; it never triggers a send. No automated form submission, no purchased
lists, no scraping.

## Lifecycle (record actual dates and outcomes only)

`draft_pending_approval` → `approved_to_send` (set `human_approved` date) →
`sent` (`contact_date`) → `replied` (`reply`) → `discovery` (`discovery_outcome`)
→ `proposal` (`pilot_status = proposed`) → `won` / `lost`.

- Only write a date or outcome that actually happened. Never pre-fill a reply,
  a call, an appointment or a win.
- Max 3 touches; stop immediately on `declined` or `opted_out` (never reply to an
  opt-out).

## Stage rules (keep it honest)

- `contacted` only after a human actually sent a message (the templates in
  `outreach-drafts.md` are drafts — a human sends them).
- `demo_booked` only for a real calendar slot.
- `won` only after the narrow pilot is agreed; then delivery tracking starts
  against the success criteria (`first-client-demo-and-offer.md`).

## Weekly review (15 minutes)

- Every `contacted` with `next_follow_up` in the past → send the single follow-up
  template or mark `lost`.
- Every `replied` → book the 20-minute discovery call
  (`discovery-call-script.md`).
- Every `demo_done` → send the pilot proposal (`pilot-proposal-template.md`) or
  move to `nurture`.
- Count: contacted, replies, demos, wins. Nothing else.

## Delivery tracking (after `won`)

Track the engagement against the success criteria, not vanity metrics:

| Metric | Target |
| --- | --- |
| Captured leads reaching the pipeline | 100% |
| Lead arrival → owner alerted | under 60 seconds |
| Unexplained failed runs | zero (every failure has an `error_code`) |
| Messages sent without approval | zero |
| Duplicate deliveries | zero |
