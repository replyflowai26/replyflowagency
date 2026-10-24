# AI Operations Assistant — client offer

> Operational draft only. Do **not** send messages, contact prospects, create
> accounts or incur costs from this document. It prepares the offer; a human
> sends anything outbound.

## The one narrow offer

**An internal AI Operations Assistant** that turns a plain-language request into
a small, reviewable, auditable piece of work — and never acts on anything
consequential without a human approval.

Examples of the first, safe slices:

- "Summarise this week's inbound pipeline and write a status report."
- "Research these three competitors and draft a one-page brief."
- "Draft a follow-up reply to this inbound lead for my review."

Consequential actions (sending the reply, moving money, changing production) are
**gated**: the assistant prepares the work and asks the owner to approve it.

## Why this is deliverable

It is built on capabilities that already exist and are tested:

- The assistant's task status reuses the platform's existing run state machine
  (`src/lib/automation/run-state-machine.ts`). No parallel queue or dispatcher.
- The durable human-approval gate mirrors the workflow-run approval axis already
  shipped (`20261005000000_workflow_run_approval_state.sql`).
- Tools are a fixed allowlist; internal tools are deterministic and in-process,
  and consequential tools are refused by the executor.
- Every action is recorded as an append-only event, giving a complete audit
  trail. See `Docs/architecture/company-agents-architecture.md`.

## What the engagement includes

1. One internal "Operations Assistant" agent configured for one workflow.
2. A short task catalogue (2–5 request types) mapped to allowlisted steps.
3. A human approval step for every consequential action.
4. A run/audit trail the owner can review.
5. A local demo (`npm run demo:ops-assistant`) and a green test suite.

## What we deliberately do NOT promise

- **No live language-model magic.** Today the assistant uses a deterministic
  planner. A hosted model can be added later behind a reviewed seam; we do not
  claim it is wired now.
- **No autonomous campaigns, payments or production changes.** Consequential
  steps require explicit human approval.
- **No credentials handled by the assistant.** Integrations are referenced by id;
  secrets live in a vault/secret manager.
- **No revenue, lead-volume or accuracy guarantees.**
- **Nothing that requires us to apply a migration to your production database
  without a written change window.**

## Human-in-the-loop model

```
request → deterministic plan → [consequential?]
                                    │ yes
                        approval_state = pending
                                    │
                       owner approves / rejects
                                    │
                    run allowlisted steps → result + audit trail
```

A pending approval is never auto-completed or timed out. A repeated or concurrent
decision cannot trigger the action twice.

## Engagement prerequisites

- [ ] One clearly-scoped internal workflow chosen (single input, single output).
- [ ] A named human approver and an owner/admin role in the workspace.
- [ ] Read access to the knowledge the assistant needs (notes, docs, numbers).
- [ ] Agreement that consequential integrations start disabled (unconfigured).

## Demo readiness checklist

- [ ] `npm run test:bridge` is green (includes the agent suite).
- [ ] `npm run demo:ops-assistant` shows plan → approval gate → mock action.
- [ ] The approval gate visibly blocks a consequential step before approval.
- [ ] A rejected task ends `cancelled`; an approved task runs once.
- [ ] The event timeline is readable end to end.

## Discovery questions

1. What repetitive internal task costs the most human time each week?
2. What does "done" look like for that task, concretely?
3. Which steps are safe to automate, and which need a human?
4. Who is the single approver, and how fast can they respond?
5. What is the worst outcome we must prevent (wrong send, double charge, data
   leak)?

## Success metrics

- Time from request → reviewed draft (target: minutes, not hours).
- Percentage of tasks with a complete audit trail (target: 100%).
- Zero unapproved consequential actions (target: always 0).
- Owner-reported time saved per week.

## Disqualifiers

- Wants fully autonomous outbound actions with no human approval.
- Expects live LLM behaviour before a model is contracted and configured.
- Has no single clearly-scoped internal workflow to start with.
- Requires production database changes outside a written change window.
