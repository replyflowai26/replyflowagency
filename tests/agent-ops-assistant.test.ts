import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import {
  AGENT_ROLE_KINDS,
  isAgentApprovalState,
  isAgentRoleKind,
  isAgentTaskPriority,
  isHumanRoleKind,
  isValidReportsTo,
} from "../src/lib/agents/types"
import { buildPlan, classifyObjective, validateObjective } from "../src/lib/agents/planner-core"
import {
  createDeterministicToolExecutor,
  getAgentTool,
  isAllowlistedTool,
  isConsequentialTool,
  listAgentTools,
  AGENT_TOOL_IDS,
} from "../src/lib/agents/tools"
import {
  createDeterministicModelAdapter,
  createUnavailableModelAdapter,
} from "../src/lib/agents/model-adapter"
import {
  createMockExternalActionAdapter,
  createUnconfiguredExternalActionAdapter,
} from "../src/lib/agents/external-action-adapter"
import { buildTaskMemory } from "../src/lib/agents/memory-core"
import {
  cancelAgentTask,
  executeAgentTask,
  normalizeStartInput,
  resolveAgentApproval,
  startAgentTask,
  AGENT_MEMORY_TABLE,
  AGENT_TASK_EVENT_TABLE,
  AGENT_TASK_TABLE,
  OPS_ASSISTANT_EVENTS,
  type AgentTaskClient,
  type OpsAssistantContext,
  type OpsAssistantDeps,
} from "../src/lib/agents/ops-assistant"

// ─── In-memory fake Supabase client ──────────────────────────────────────────
// Supports only the builder calls the orchestrator uses. No database, no network.

type Row = Record<string, any>

function createFakeClient() {
  const tables: Record<string, Row[]> = {
    [AGENT_TASK_TABLE]: [],
    [AGENT_TASK_EVENT_TABLE]: [],
    [AGENT_MEMORY_TABLE]: [],
  }

  const from = (table: string) => {
    if (!tables[table]) tables[table] = []
    const filters: { col: string; val: any }[] = []
    let pendingInsert: Row | null = null
    let pendingUpdate: Row | null = null
    const matched = () => tables[table].filter((r) => filters.every((f) => r[f.col] === f.val))
    const flushInsert = (): { error: any } => {
      if (!pendingInsert) return { error: null }
      const row = pendingInsert
      pendingInsert = null
      if (table === AGENT_TASK_TABLE && row.idempotency_key) {
        const dup = tables[table].find(
          (r) => r.organization_id === row.organization_id && r.idempotency_key === row.idempotency_key,
        )
        if (dup) return { error: { code: "23505" } }
      }
      tables[table].push({ ...row })
      return { error: null }
    }
    const flushUpdate = () => {
      if (pendingUpdate) {
        matched().forEach((r) => Object.assign(r, pendingUpdate))
        pendingUpdate = null
      }
    }
    const chain: any = {
      select: () => chain,
      eq(col: string, val: any) {
        filters.push({ col, val })
        return chain
      },
      // No-ops consumed by ensureAgentIdentity (agent-identity.ts); the fake
      // stores rows in creation order and these tests never seed duplicates.
      order: () => chain,
      limit: () => chain,
      insert(row: Row) {
        pendingInsert = { ...row }
        return chain
      },
      update(patch: Row) {
        pendingUpdate = { ...patch }
        return chain
      },
      async maybeSingle() {
        const rows = matched()
        const ins = flushInsert()
        if (ins.error) return { data: null, error: ins.error }
        flushUpdate()
        return { data: rows.length ? rows[0] : null, error: null }
      },
      then(onFulfilled: any) {
        return Promise.resolve()
          .then(() => {
            const ins = flushInsert()
            flushUpdate()
            return ins
          })
          .then(onFulfilled)
      },
    }
    return chain
  }

  return { tables, from }
}

const ORG = "11111111-1111-4111-8111-111111111111"
const ORG_B = "99999999-9999-4999-8999-999999999999"
const CTX: OpsAssistantContext = { organizationId: ORG, agentId: "ops-assistant", createdByUserId: "user-1" }
const NOW = () => new Date("2026-10-06T00:00:00.000Z")

function makeDeps(overrides: Partial<OpsAssistantDeps> = {}): { deps: OpsAssistantDeps; fake: ReturnType<typeof createFakeClient> } {
  const fake = createFakeClient()
  let seq = 0
  const deps: OpsAssistantDeps = {
    supabase: fake as unknown as AgentTaskClient,
    newId: () => `task-${String(++seq).padStart(3, "0")}`,
    now: NOW,
    ...overrides,
  }
  return { deps, fake }
}

// ─── Architecture / boundaries ───────────────────────────────────────────────

test("role hierarchy: human CEO is top; reports-to rules are enforced", () => {
  assert.equal(isValidReportsTo("human-ceo", null), true)
  assert.equal(isValidReportsTo("human-ceo", "ai-ceo"), false)
  assert.equal(isValidReportsTo("ai-ceo", "human-ceo"), true)
  assert.equal(isValidReportsTo("ai-chairman", "ai-ceo"), true)
  assert.equal(isValidReportsTo("ai-manager", "ai-chairman"), true)
  assert.equal(isValidReportsTo("ai-worker", "ai-manager"), true)
  // A worker may not report directly to the AI CEO.
  assert.equal(isValidReportsTo("ai-worker", "ai-ceo"), false)
  assert.equal(isHumanRoleKind("human-ceo"), true)
  assert.equal(isHumanRoleKind("ai-worker"), false)
})

test("agent guards accept only known vocabulary", () => {
  assert.equal(isAgentRoleKind("ai-worker"), true)
  assert.equal(isAgentRoleKind("robot"), false)
  assert.equal(isAgentTaskPriority("urgent"), true)
  assert.equal(isAgentTaskPriority("sometimes"), false)
  assert.equal(isAgentApprovalState("pending"), true)
  assert.equal(isAgentApprovalState("maybe"), false)
  assert.ok(AGENT_ROLE_KINDS.includes("human-ceo"))
})

// ─── Deterministic classifier / planner ──────────────────────────────────────

test("classifier is deterministic and explainable", () => {
  assert.equal(classifyObjective("Send a follow-up email to the lead"), "outreach")
  assert.equal(classifyObjective("Create the monthly invoice for Acme"), "finance")
  assert.equal(classifyObjective("Deploy the hotfix to production"), "production")
  assert.equal(classifyObjective("Book a meeting with the client"), "scheduling")
  assert.equal(classifyObjective("Write a weekly status report"), "reporting")
  assert.equal(classifyObjective("Research competitors in the market"), "research")
  assert.equal(classifyObjective("Summarise the pipeline data"), "data-summary")
  assert.equal(classifyObjective("Do the thing"), "general")
})

test("plans reference only allowlisted tools", () => {
  for (const objective of [
    "Send an outreach email",
    "Create an invoice",
    "Deploy to production",
    "Write a report",
    "Research the market",
    "Book a meeting",
    "Do the thing",
  ]) {
    const plan = buildPlan({ objective })
    for (const step of plan.steps) {
      assert.ok(isAllowlistedTool(step.tool), `${step.tool} must be allowlisted`)
    }
    assert.equal(plan.deterministic, true)
  }
})

test("consequential categories force an approval gate", () => {
  const outreach = buildPlan({ objective: "Send a follow-up email" })
  assert.equal(outreach.requiresApproval, true)
  assert.ok(outreach.steps.some((s) => s.consequential && s.tool === "external.message.send"))

  const finance = buildPlan({ objective: "Create an invoice payment" })
  assert.equal(finance.requiresApproval, true)
  assert.ok(finance.steps.some((s) => s.consequential))

  const production = buildPlan({ objective: "Deploy to production" })
  assert.equal(production.requiresApproval, true)

  const reporting = buildPlan({ objective: "Write a weekly report" })
  assert.equal(reporting.requiresApproval, false)
  assert.ok(reporting.steps.every((s) => !s.consequential))
})

test("objective validation rejects short, long and non-string input", () => {
  assert.equal(validateObjective("short").ok, false)
  assert.equal(validateObjective("x".repeat(1001)).ok, false)
  assert.equal(validateObjective(42).ok, false)
  assert.equal(validateObjective("A valid objective").ok, true)
})

// ─── Start task ──────────────────────────────────────────────────────────────

test("normalizeStartInput validates title/priority and clamps retries", () => {
  const bad = normalizeStartInput({ title: "", objective: "A valid objective" })
  assert.equal(bad.ok, false)
  const badPriority = normalizeStartInput({ title: "T", objective: "A valid objective", priority: "soon" as any })
  assert.equal(badPriority.ok, false)
  const good = normalizeStartInput({ title: "T", objective: "A valid objective", maxRetries: 99 })
  assert.equal(good.ok, true)
  if (good.ok) assert.equal(good.value.maxRetries, 5)
})

test("reporting task is planned, queued, and needs no approval", async () => {
  const { deps, fake } = makeDeps()
  const result = await startAgentTask({ title: "Weekly report", objective: "Write a weekly status report" }, CTX, deps)
  assert.equal(result.outcome, "planned")
  const row = fake.tables[AGENT_TASK_TABLE][0]
  assert.equal(row.status, "queued")
  assert.equal(row.approval_state, "none")
  assert.equal(row.requires_approval, false)
  assert.equal(row.category, "reporting")
  assert.equal(fake.tables[AGENT_TASK_EVENT_TABLE][0].event_type, OPS_ASSISTANT_EVENTS.planned)
})

test("outreach task is held pending human approval", async () => {
  const { deps, fake } = makeDeps()
  const result = await startAgentTask({ title: "Reply", objective: "Send a follow-up email to the inbound lead" }, CTX, deps)
  assert.equal(result.outcome, "awaiting_approval")
  const row = fake.tables[AGENT_TASK_TABLE][0]
  assert.equal(row.status, "queued")
  assert.equal(row.approval_state, "pending")
  assert.equal(row.requires_approval, true)
  const types = fake.tables[AGENT_TASK_EVENT_TABLE].map((e) => e.event_type)
  assert.ok(types.includes(OPS_ASSISTANT_EVENTS.approvalRequired))
})

test("duplicate objective is idempotent for the same agent", async () => {
  const { deps, fake } = makeDeps()
  const first = await startAgentTask({ title: "A", objective: "Write a weekly status report" }, CTX, deps)
  const second = await startAgentTask({ title: "A", objective: "Write a weekly status report" }, CTX, deps)
  assert.equal(first.outcome, "planned")
  assert.equal(second.outcome, "duplicate")
  if (first.outcome === "planned" && second.outcome === "duplicate") {
    assert.equal(second.taskId, first.taskId)
  }
  assert.equal(fake.tables[AGENT_TASK_TABLE].length, 1)
})

test("invalid input is rejected without creating a row", async () => {
  const { deps, fake } = makeDeps()
  const result = await startAgentTask({ title: "", objective: "no" }, CTX, deps)
  assert.equal(result.outcome, "rejected")
  assert.equal(fake.tables[AGENT_TASK_TABLE].length, 0)
})

test("an unavailable model adapter fails honestly (no silent fallback)", async () => {
  const { deps, fake } = makeDeps({ model: createUnavailableModelAdapter() })
  const result = await startAgentTask({ title: "T", objective: "Write a weekly status report" }, CTX, deps)
  assert.equal(result.outcome, "model_unavailable")
  assert.equal(fake.tables[AGENT_TASK_TABLE].length, 0)
})

// ─── Execute task ────────────────────────────────────────────────────────────

test("reporting task executes deterministically to success with a report and memory", async () => {
  const { deps, fake } = makeDeps()
  const started = await startAgentTask({ title: "Weekly", objective: "Write a weekly status report", knowledge: ["Lead volume up 12%"] }, CTX, deps)
  assert.equal(started.outcome, "planned")
  const taskId = (started as { taskId: string }).taskId

  const executed = await executeAgentTask(taskId, CTX, deps, { knowledge: ["Lead volume up 12%"] })
  assert.equal(executed.outcome, "succeeded")
  if (executed.outcome === "succeeded") {
    assert.ok(executed.result.report.includes("Lead volume up 12%"))
    assert.ok(executed.result.stepOutcomes.length >= 1)
  }
  const row = fake.tables[AGENT_TASK_TABLE][0]
  assert.equal(row.status, "succeeded")
  assert.ok(typeof row.completed_at === "string")
  const memory = fake.tables[AGENT_MEMORY_TABLE]
  assert.equal(memory.length, 3)
  assert.deepEqual([...new Set(memory.map((m) => m.scope))].sort(), ["agent", "organization", "task"])
})

test("execute refuses a task still awaiting approval (does not run)", async () => {
  const { deps, fake } = makeDeps()
  const started = await startAgentTask({ title: "Reply", objective: "Send a follow-up email to the lead" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const executed = await executeAgentTask(taskId, CTX, deps)
  assert.equal(executed.outcome, "awaiting_approval")
  assert.equal(fake.tables[AGENT_TASK_TABLE][0].status, "queued")
})

test("execute on a terminal task is refused", async () => {
  const { deps } = makeDeps()
  const started = await startAgentTask({ title: "Weekly", objective: "Write a weekly status report" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  await executeAgentTask(taskId, CTX, deps)
  const again = await executeAgentTask(taskId, CTX, deps)
  assert.equal(again.outcome, "invalid_state")
})

test("org isolation: a task is invisible from another organization", async () => {
  const { deps } = makeDeps()
  const started = await startAgentTask({ title: "Weekly", objective: "Write a weekly status report" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const executed = await executeAgentTask(taskId, { ...CTX, organizationId: ORG_B }, deps)
  assert.equal(executed.outcome, "not_found")
})

// ─── Approval flows ──────────────────────────────────────────────────────────

test("rejecting a pending task cancels it", async () => {
  const { deps, fake } = makeDeps()
  const started = await startAgentTask({ title: "Reply", objective: "Send a follow-up email to the lead" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const rejected = await resolveAgentApproval(taskId, "rejected", CTX, deps)
  assert.equal(rejected.outcome, "cancelled")
  assert.equal(fake.tables[AGENT_TASK_TABLE][0].status, "cancelled")
})

test("approving a task with a mocked external adapter runs the consequential step once", async () => {
  const external = createMockExternalActionAdapter()
  const { deps } = makeDeps({ external })
  const started = await startAgentTask({ title: "Reply", objective: "Send a follow-up email to the lead" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const approved = await resolveAgentApproval(taskId, "approved", CTX, deps)
  assert.equal(approved.outcome, "succeeded")
  assert.equal(external.performed.length, 1)
  assert.equal(external.performed[0].step.tool, "external.message.send")
})

test("approving with the default (unconfigured) external adapter fails honestly", async () => {
  const { deps, fake } = makeDeps({ external: createUnconfiguredExternalActionAdapter() })
  const started = await startAgentTask({ title: "Reply", objective: "Send a follow-up email to the lead" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const approved = await resolveAgentApproval(taskId, "approved", CTX, deps)
  assert.equal(approved.outcome, "failed")
  if (approved.outcome === "failed") assert.equal(approved.errorCode, "EXTERNAL_ACTION_UNCONFIGURED")
  assert.equal(fake.tables[AGENT_TASK_TABLE][0].status, "failed")
})

test("a repeated approval decision is refused (no double action)", async () => {
  const external = createMockExternalActionAdapter()
  const { deps } = makeDeps({ external })
  const started = await startAgentTask({ title: "Reply", objective: "Send a follow-up email to the lead" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const first = await resolveAgentApproval(taskId, "approved", CTX, deps)
  const second = await resolveAgentApproval(taskId, "approved", CTX, deps)
  assert.equal(first.outcome, "succeeded")
  assert.equal(second.outcome, "invalid_state")
  assert.equal(external.performed.length, 1)
})

// ─── Approver attribution in audit events (task 60) ──────────────────────────

const APPROVER_CTX: OpsAssistantContext = { ...CTX, actorUserId: "approver-7" }

function eventsOfType(
  fake: ReturnType<typeof createFakeClient>,
  eventType: string,
): Row[] {
  return fake.tables[AGENT_TASK_EVENT_TABLE].filter((e) => e.event_type === eventType)
}

test("approval and rejection events record the acting approver", async () => {
  const external = createMockExternalActionAdapter()
  const { deps, fake } = makeDeps({ external })
  const started = await startAgentTask({ title: "Reply", objective: "Send a follow-up email to the lead" }, APPROVER_CTX, deps)
  const taskId = (started as { taskId: string }).taskId

  const approved = await resolveAgentApproval(taskId, "approved", APPROVER_CTX, deps)
  assert.equal(approved.outcome, "succeeded")
  const granted = eventsOfType(fake, OPS_ASSISTANT_EVENTS.approvalGranted)
  assert.equal(granted.length, 1)
  assert.equal(granted[0].payload.decided_by_user_id, "approver-7")

  // A second task exercises the rejection path.
  const second = await startAgentTask({ title: "Reply 2", objective: "Send another follow-up email" }, APPROVER_CTX, deps)
  const secondId = (second as { taskId: string }).taskId
  const rejected = await resolveAgentApproval(secondId, "rejected", APPROVER_CTX, deps)
  assert.equal(rejected.outcome, "cancelled")
  const rejectedEvents = eventsOfType(fake, OPS_ASSISTANT_EVENTS.approvalRejected)
  assert.equal(rejectedEvents.length, 1)
  assert.equal(rejectedEvents[0].payload.decided_by_user_id, "approver-7")
  const cancelledEvents = eventsOfType(fake, OPS_ASSISTANT_EVENTS.cancelled).filter(
    (e) => e.task_id === secondId,
  )
  assert.equal(cancelledEvents.length, 1)
  assert.equal(cancelledEvents[0].payload.decided_by_user_id, "approver-7")
})

test("a decision without an authenticated actor records null, never a guess", async () => {
  const { deps, fake } = makeDeps({ external: createMockExternalActionAdapter() })
  // The pre-task-60 CTX (no actorUserId) must remain valid and the event must
  // honestly record null rather than omit or fabricate the field.
  const started = await startAgentTask({ title: "Reply", objective: "Send a follow-up email to the lead" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const approved = await resolveAgentApproval(taskId, "approved", CTX, deps)
  assert.equal(approved.outcome, "succeeded")

  const granted = eventsOfType(fake, OPS_ASSISTANT_EVENTS.approvalGranted)
  assert.equal(granted.length, 1)
  assert.equal(granted[0].payload.decided_by_user_id, null)
  assert.ok("decided_by_user_id" in granted[0].payload, "the key must always be present")
})

test("the server wiring threads the session user as the acting approver", () => {
  // buildContext (ops-assistant-service.ts) must set actorUserId from the
  // session user so decideOpsApproval records an attributable decision.
  const src = readFileSync(
    join(process.cwd(), "src/lib/agents/ops-assistant-service.ts"),
    "utf8",
  )
  assert.match(src, /actorUserId:\s*userId/)
  // The approval boundary itself is unchanged: still owner/admin only.
  assert.match(src, /APPROVAL_ROLES/)
})

// ─── Failure, retries, cancellation ──────────────────────────────────────────

test("internal tool failure exhausts retries and fails the task", async () => {
  let calls = 0
  const { deps, fake } = makeDeps({
    tools: () => {
      calls += 1
      return { ok: false, errorCode: "TOOL_BOOM", message: "boom" }
    },
  })
  const started = await startAgentTask({ title: "Weekly", objective: "Write a weekly status report", maxRetries: 1 }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const executed = await executeAgentTask(taskId, CTX, deps)
  assert.equal(executed.outcome, "failed")
  if (executed.outcome === "failed") assert.equal(executed.errorCode, "TOOL_BOOM")
  assert.equal(calls, 2) // initial + 1 retry
  const row = fake.tables[AGENT_TASK_TABLE][0]
  assert.equal(row.status, "failed")
  assert.equal(row.retry_count, 1)
  assert.ok(fake.tables[AGENT_TASK_EVENT_TABLE].some((e) => e.event_type === OPS_ASSISTANT_EVENTS.retry))
})

test("cancelling a queued task works and is idempotent-safe", async () => {
  const { deps, fake } = makeDeps()
  const started = await startAgentTask({ title: "Weekly", objective: "Write a weekly status report" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const cancelled = await cancelAgentTask(taskId, CTX, deps)
  assert.equal(cancelled.outcome, "cancelled")
  assert.equal(fake.tables[AGENT_TASK_TABLE][0].status, "cancelled")
  const again = await cancelAgentTask(taskId, CTX, deps)
  assert.equal(again.outcome, "invalid_state")
  const executed = await executeAgentTask(taskId, CTX, deps)
  assert.equal(executed.outcome, "invalid_state")
})

test("a task cancelled between steps is not completed", async () => {
  const { deps, fake } = makeDeps()
  const started = await startAgentTask({ title: "Weekly", objective: "Write a weekly status report" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const base = createDeterministicToolExecutor()
  const deps2: OpsAssistantDeps = {
    ...deps,
    tools: (toolId, context) => {
      // Simulate an external cancellation landing during the first step.
      const row = fake.tables[AGENT_TASK_TABLE].find((r) => r.id === taskId)
      if (row && toolId === "internal.knowledge.search") row.status = "cancelled"
      return base(toolId, context)
    },
  }
  const executed = await executeAgentTask(taskId, CTX, deps2)
  assert.equal(executed.outcome, "invalid_state")
})

// ─── Tool + model + external seams ───────────────────────────────────────────

test("tool registry is the allowlist and the executor refuses unsafe calls", () => {
  assert.equal(listAgentTools().length, AGENT_TOOL_IDS.length)
  assert.ok(isConsequentialTool("external.message.send"))
  assert.ok(!isConsequentialTool("internal.report.compose"))
  assert.equal(getAgentTool("nope"), null)

  const run = createDeterministicToolExecutor()
  const ctx = { objective: "Send a follow-up email", knowledge: [], data: {} }
  const unknown = run("not.a.tool", ctx)
  assert.equal(unknown.ok, false)
  const consequential = run("external.message.send", ctx)
  assert.equal(consequential.ok, false)
  if (!consequential.ok) assert.equal(consequential.errorCode, "TOOL_REQUIRES_APPROVAL")
})

test("model adapter: deterministic default and honest unavailable path", async () => {
  const det = createDeterministicModelAdapter()
  assert.equal(det.isDeterministic, true)
  const planned = await det.plan({ objective: "Write a weekly status report" })
  assert.equal(planned.ok, true)

  const unavailable = createUnavailableModelAdapter()
  const failed = await unavailable.plan({ objective: "Write a weekly status report" })
  assert.equal(failed.ok, false)
  if (!failed.ok) assert.equal(failed.reason, "unavailable")
})

test("memory is scoped and bounded", () => {
  const entries = buildTaskMemory({
    organizationId: ORG,
    agentId: "ops-assistant",
    task: { id: "t1", title: "Weekly", category: "reporting", priority: "normal" },
    result: { summary: "done", report: "x".repeat(5000), findings: {}, stepOutcomes: [] },
    now: "2026-10-06T00:00:00.000Z",
  })
  assert.equal(entries.length, 3)
  for (const entry of entries) {
    assert.ok(JSON.stringify(entry.value).length <= 2200)
    assert.equal(entry.organizationId, ORG)
  }
})

// ─── Security / architecture source inspection ───────────────────────────────

test("agent library has no model/network/queue calls and no secrets", () => {
  const dir = join(process.cwd(), "src/lib/agents")
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"))
  assert.ok(files.length >= 6)
  // The real model adapter (model-provider-openai.ts) legitimately performs
  // network I/O through an explicitly-configured, injected fetch. Every OTHER
  // agent module must stay completely offline. The adapter's own safety
  // properties are asserted in the dedicated test below.
  const networkCapable = new Set(["model-provider-openai.ts"])
  // Provider markers, not the bare word (the model adapter documents that no
  // provider is wired, which is the point).
  const providerMarkers = ["api.openai", "api.anthropic", "generativelanguage", "process.env.openai", "process.env.anthropic"]
  for (const file of files) {
    const src = readFileSync(join(dir, file), "utf8").toLowerCase()
    for (const marker of providerMarkers) {
      assert.ok(!src.includes(marker), `${file} must not call LLM provider "${marker}"`)
    }
    if (!networkCapable.has(file)) {
      assert.ok(!src.includes("fetch("), `${file} must not make network calls`)
    }
    assert.ok(!src.includes("n8n"), `${file} must not duplicate the n8n dispatcher`)
    assert.ok(!src.includes("dispatchworkflowrun"), `${file} must not duplicate the dispatcher`)
  }
})

test("the real model adapter is opt-in, key-safe and provider-agnostic", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/agents/model-provider-openai.ts"), "utf8")
  const lower = src.toLowerCase()
  // No hard-coded provider host: the base URL must come from configuration.
  for (const host of [
    "api.openai.com",
    "api.anthropic.com",
    "generativelanguage.googleapis.com",
    "openai.com",
    "anthropic.com",
  ]) {
    assert.ok(!lower.includes(host), `model adapter must not hard-code provider host "${host}"`)
  }
  // A server-only key must never be exposed through a public env var.
  assert.ok(!src.includes("NEXT_PUBLIC_"), "model adapter must not use NEXT_PUBLIC_ env vars")
  // The key is read only through a named server-side constant.
  assert.ok(src.includes("REPLYFLOW_AI_API_KEY"))
  // It is sent only as an Authorization header.
  assert.ok(lower.includes("authorization"))
  // It is opt-in: with no configuration the deterministic planner is used.
  assert.ok(src.includes("createDeterministicModelAdapter"))
  // Untrusted model output is parsed, never trusted.
  assert.ok(src.includes("parseModelPlan"))
  assert.ok(src.includes("isAllowlistedTool"))
  assert.ok(src.includes("isConsequentialTool"))
})

test("service wiring is server-only, authenticated and role-gated at the boundary", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/agents/ops-assistant-service.ts"), "utf8")
  assert.ok(src.startsWith('import "server-only"'))
  assert.ok(src.includes("createAdminClient"))
  assert.ok(src.includes("organization_memberships"))
  assert.ok(src.includes("APPROVAL_ROLES"))
  assert.ok(src.includes("assertRole"))
})

test("prepared migration defines the four tables, approval axis and append-only events", () => {
  const file = join(process.cwd(), "supabase/migrations/20261006000000_agent_runtime_foundation.sql")
  const sql = readFileSync(file, "utf8")
  assert.ok(sql.includes("create table if not exists public.ai_agents"))
  assert.ok(sql.includes("create table if not exists public.ai_agent_tasks"))
  assert.ok(sql.includes("create table if not exists public.ai_agent_task_events"))
  assert.ok(sql.includes("create table if not exists public.ai_agent_memory"))
  assert.ok(sql.includes("approval_state in ('none','pending','approved','rejected')"))
  assert.ok(sql.includes("status in ('queued','running','succeeded','failed','cancelled')"))
  assert.ok(sql.includes("enable row level security"))
  assert.ok(sql.includes("private.is_org_member"))
  assert.ok(sql.includes("private.has_org_role"))
  assert.ok(sql.toLowerCase().includes("append-only"))
})
