# Company Agents Architecture (Jarvis foundation)

> Status: foundation implemented and tested (deterministic, no live LLM). One
> internal agent — the **Operations Assistant** — is functional as a
> dependency-injected orchestrator with a prepared (not applied) migration.
> This document describes the model and the boundaries, not a running production
> deployment.

## Purpose

Give ReplyFlow a small, safe foundation for the "Jarvis" AI-company concept:
a hierarchy of AI agents that take clearly-scoped tasks, plan them, use only
allowlisted tools, ask a human before anything consequential, and report back
with an auditable trail.

The design is deliberately minimal. The goal is a foundation that one internal
agent can be built and tested on today, and that later agents (AI CEO,
chairmen, managers, more workers) can slot into without redesign.

## Principles

1. **Reuse, do not duplicate.** Agent task status uses the existing workflow-run
   vocabulary (`queued / running / succeeded / failed / cancelled`) from
   `src/lib/automation/run-state-machine.ts`. The approval axis mirrors
   `workflow_runs.approval_state`. There is **no second queue and no second
   dispatcher** — the agent runs in-process.
2. **Deterministic by default.** ReplyFlow has **no OpenAI (or other LLM)
   integration configured at runtime**. The default model adapter is a pure,
   deterministic planner. Adding a real provider is a deliberate, reviewed change
   behind a seam — never an implicit fallback.
3. **Human-in-the-loop for consequences.** Sending a message, moving money, or
   changing production is gated behind a durable approval state. Until a human
   approves, the agent cannot act.
4. **Allowlist, not capability.** An agent may only call tools in a fixed
   registry. Unknown tools are refused; there is no free-form "run any action".
5. **Honest failure.** If a capability is not configured, the agent records an
   explicit failure code. It never reports an action as done when it was not.
6. **Tenant isolation.** Every agent, task, event and memory row is owned by an
   `organization_id`; RLS + the existing membership/role helpers are the
   authorization layer.
7. **No secrets in agent data.** Agents reference model/external configuration by
   id. No credential, token or secret is stored in the agent tables.

## Role hierarchy

The company OS is modelled as a fixed reporting tree. Only `ai-worker`
(Operations Assistant) is implemented today; the rest are declared so the data
model and validation rules do not change later.

| Role kind      | Reports to   | Implemented today |
| -------------- | ------------ | ----------------- |
| `human-ceo`    | — (top)      | n/a (human)       |
| `ai-ceo`       | `human-ceo`  | declared only     |
| `ai-chairman`  | `ai-ceo`     | declared only     |
| `ai-manager`   | `ai-chairman`| declared only     |
| `ai-worker`    | `ai-manager` | **Operations Assistant** |

Hierarchy rules are enforced as data in `src/lib/agents/types.ts`
(`isValidReportsTo`). A worker may not report directly to the AI CEO.

## Task lifecycle

Two orthogonal axes, exactly like workflow runs:

- **Execution status** (`AgentTaskStatus`): `queued → running → succeeded |
  failed | cancelled`. Reused from the run state machine.
- **Approval state** (`AgentApprovalState`): `none | pending | approved |
  rejected`. Mirrors the Task-4 durable approval column.

Flow:

```
startAgentTask ──► plan (deterministic) ──► queued
                                             │
             requiresApproval? ──yes──► approval_state = pending
             │                                      │
             no                                human decides
             │                            ┌────────┴────────┐
             ▼                        approved            rejected
     executeAgentTask ───────────────────► task cancelled
             │
     run allowlisted steps ──► succeeded (result + memory) | failed
```

Every state change is a guarded compare-and-set (`.eq("status", expected)`), so
concurrent actors serialize and the loser writes nothing. Approval resolution
uses a compare-and-set on `(status = 'queued', approval_state = 'pending')`, so a
repeated or concurrent decision cannot trigger the consequential step twice.

## Components

| File | Responsibility |
| ---- | -------------- |
| `src/lib/agents/types.ts` | Pure architecture: roles, hierarchy, task/approval/priority vocab, memory scopes. |
| `src/lib/agents/planner-core.ts` | Deterministic task classifier + plan builder. No model. |
| `src/lib/agents/tools.ts` | Allowlisted tool registry + pure internal executor; consequential tools refused. |
| `src/lib/agents/model-adapter.ts` | Model seam. Default deterministic; explicit unavailable adapter. |
| `src/lib/agents/model-provider-openai.ts` | Opt-in real model adapter (OpenAI-compatible wire format). Env-configured, no hard-coded provider URL, untrusted-output parsing. |
| `src/lib/agents/external-action-adapter.ts` | Consequential-action seam. Default **unconfigured** (fails honestly); mock for tests. |
| `src/lib/agents/memory-core.ts` | Minimal, bounded, scoped memory builder. |
| `src/lib/agents/ops-assistant.ts` | DI orchestrator: start / execute / approve / cancel. |
| `src/lib/agents/ops-assistant-service.ts` | Server-only wiring + authorization at the boundary. |

## Tools and the allowlist

Tools are declared once in `src/lib/agents/tools.ts`:

- `internal.*` — deterministic, in-process, no network. Examples:
  `internal.knowledge.search`, `internal.tasks.summarize`,
  `internal.report.compose`, `internal.content.draft`,
  `internal.schedule.propose`.
- `external.*` / `production.*` — **consequential**. Declared so a plan can name
  them and the gate can recognise them, but never executed by the internal
  executor. They run only through an injected `ExternalActionAdapter`, and only
  after approval.

The planner is conservative: any category that could produce an external side
effect (`outreach`, `finance`, `production`) yields a plan containing a
consequential step, which forces the approval gate.

## Model seam

```
AgentModelAdapter { ref, isDeterministic, plan(request): Promise<AgentPlanResult> }
```

- `createDeterministicModelAdapter()` — the default. Always available, never calls
  out, stable output, `ref = "deterministic-planner-v1"`.
- `createUnavailableModelAdapter()` — fails honestly when a partially-configured
  model is detected.
- `createOpenAiCompatibleModelAdapter(config)` (in `model-provider-openai.ts`) —
  the real, opt-in adapter. It speaks the OpenAI-compatible chat-completions
  format, so any compatible provider works.

Selection is `resolveAgentModelAdapter(env)`:

| Environment | Adapter chosen |
| ----------- | -------------- |
| none of `REPLYFLOW_AI_API_KEY` / `_BASE_URL` / `_MODEL` set | deterministic planner |
| any set but incomplete or invalid | unavailable adapter (fails honestly) |
| all set and valid | real OpenAI-compatible adapter |

Safety properties of the real adapter (enforced by tests):

- **No hard-coded provider URL.** `REPLYFLOW_AI_BASE_URL` must be an absolute
  `https` URL (http allowed only for loopback); credentials in the URL are
  rejected.
- **Key handling.** `REPLYFLOW_AI_API_KEY` is sent only as an `Authorization`
  header and never appears in a prompt, log line, or error message.
- **Bounded I/O.** Every attempt is wrapped in an AbortController timeout;
  5xx/network/timeout errors are retried with capped exponential backoff; 4xx is
  not retried.
- **Untrusted output.** `parseModelPlan` accepts only allowlisted tools, ignores
  the model's step ids, and derives `consequential` from the tool registry.
- **No silent AI mislabelling.** The plan carries `deterministic: false` and the
  adapter `ref`; the deterministic fallback never claims to be an LLM.

`fetchFn` and `sleep` are injectable, so the test suite never reaches the
network.

## Consequential actions

```
ExternalActionAdapter { ref, configured, perform(request): Promise<ExternalActionResult> }
```

- `createUnconfiguredExternalActionAdapter()` — the production default. Any
  attempt returns `EXTERNAL_ACTION_UNCONFIGURED` and the task fails.
- `createMockExternalActionAdapter()` — tests only. Never leaves the process.

Consequential steps are **never retried automatically** (a retry could
double-send or double-charge). Internal steps are retried up to the task's
`max_retries`.

## Memory

`src/lib/agents/memory-core.ts` produces a small, bounded set of key/value
entries scoped to `task`, `agent`, or `organization`. There are no vectors and no
embeddings. Entries are built only from already-summarised result data and are
hard-capped in size, so raw inbound payloads and PII are never stored.

## Data model (prepared, not applied)

`supabase/migrations/20261006000000_agent_runtime_foundation.sql` adds:

- `public.ai_agents` — agent identities (role kind, reports-to, tools, status).
- `public.ai_agent_tasks` — durable tasks (status + approval axes, plan, result,
  retries, idempotency key).
- `public.ai_agent_task_events` — append-only event log (mirrors
  `workflow_run_events`).
- `public.ai_agent_memory` — minimal scoped memory.

It reuses `private.is_org_member`, `private.has_org_role`,
`private.prevent_org_reassignment` and `public.set_updated_at`, and adds an
append-only guard for events. It is **additive only** and must not be applied to
production as part of this change.

## Security boundaries

- The orchestrator only ever touches the injected client. In production that is
  the service-role admin client, behind `ops-assistant-service.ts`, which
  resolves membership and enforces roles before calling the orchestrator.
- Creating/executing/cancelling a task requires `owner | admin | member`;
  resolving an approval gate requires `owner | admin`.
- RLS is the database-level backstop for any direct data access.
- Only `model-provider-openai.ts` may perform network I/O, and only through a
  configured, injected `fetch` to the operator-supplied base URL. Every other
  agent module is offline, and none can import the n8n dispatcher (verified by a
  test). The adapter never uses a `NEXT_PUBLIC_` variable.

## Extension path

1. **Populate `ai_agents`** and replace the `OPS_ASSISTANT_AGENT_ID` constant with
   a lookup — the orchestrator contract is unchanged.
2. **Add workers** by registering a role + tool allowlist; the planner maps new
   categories to tools.
3. **Add a real model** — done for OpenAI-compatible providers via
   `model-provider-openai.ts`; other providers can implement `AgentModelAdapter`.
   Keep the deterministic adapter as the offline default.
4. **Add real external adapters** (email/payment/deploy) implementing
   `ExternalActionAdapter`, each with idempotency and dry-run controls.
5. **Add managers/chairmen/CEO** as agents whose "tool" is delegating a task to a
   subordinate agent (a new internal tool), preserving the same audit trail.

## Deliberately not done

- No LLM is called by default; a real adapter exists but is selected only when
  `REPLYFLOW_AI_*` is configured. In this change it was exercised only against an
  injected fake fetch in tests — no live model call was made.
- No external action is wired; the default external-action adapter refuses.
- The migration is not applied.
- No dashboard UI page yet (it would need the migration applied to function).
