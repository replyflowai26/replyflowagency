import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  TASK_CENTER_ACTION_BLOCKED_MESSAGE,
  TASK_CENTER_ACTION_NOT_FOUND_MESSAGE,
  TASK_CENTER_AWAITING_APPROVER_NOTE,
  TASK_CENTER_INVALID_STATE_MESSAGE,
  TASK_CENTER_REJECT_FAILED_MESSAGE,
  TASK_CENTER_RUN_FAILED_MESSAGE,
  canShowApprovalControls,
  canShowRunControl,
  isPersistenceUnavailableError,
  resolveOutcomeToState,
  runOutcomeToState,
} from "../src/lib/agents/task-center"
import { buildPlan } from "../src/lib/agents/planner-core"
import {
  cancelAgentTask,
  executeAgentTask,
  resolveAgentApproval,
  startAgentTask,
  AGENT_MEMORY_TABLE,
  AGENT_TASK_EVENT_TABLE,
  AGENT_TASK_TABLE,
  OPS_ASSISTANT_ERROR_CODES,
  type AgentTaskClient,
  type OpsAssistantContext,
  type OpsAssistantDeps,
} from "../src/lib/agents/ops-assistant"
import type { AgentTask } from "../src/lib/agents/types"

// ─── In-memory fake Supabase client (same shape as agent-ops-assistant) ─────

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
const NOW = () => new Date("2026-10-07T00:00:00.000Z")

function makeDeps(overrides: Partial<OpsAssistantDeps> = {}) {
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

function seedTask(fake: ReturnType<typeof createFakeClient>, overrides: Row = {}): Row {
  const objective = String(overrides.objective ?? "Write a weekly status report")
  const plan = overrides.plan === undefined ? buildPlan({ objective }) : overrides.plan
  const row: Row = {
    id: overrides.id ?? "seeded-001",
    organization_id: overrides.organization_id ?? ORG,
    agent_id: "ops-assistant",
    created_by_user_id: "user-1",
    title: "Seeded task",
    objective,
    category: "reporting",
    priority: "normal",
    status: "queued",
    approval_state: "none",
    requires_approval: false,
    plan,
    result: null,
    error_code: null,
    error_message: null,
    retry_count: 0,
    max_retries: 2,
    idempotency_key: null,
    last_activity_at: NOW().toISOString(),
    started_at: null,
    completed_at: null,
    created_at: NOW().toISOString(),
    ...overrides,
  }
  fake.tables[AGENT_TASK_TABLE].push(row)
  return row
}

// ─── Approval outcome mapping ───────────────────────────────────────────────

test("approve + succeeded states both facts: approved AND ran to completion", () => {
  const state = resolveOutcomeToState(
    { outcome: "succeeded", taskId: "t-1", result: { summary: "", report: "", findings: {}, stepOutcomes: [] } },
    "approved",
  )
  assert.equal(state.status, "success")
  assert.equal(state.taskId, "t-1")
  assert.match(state.message ?? "", /approved and ran to completion/)
})

test("reject + cancelled states the task will not run", () => {
  const state = resolveOutcomeToState({ outcome: "cancelled", taskId: "t-2" }, "rejected")
  assert.equal(state.status, "success")
  assert.match(state.message ?? "", /rejected and cancelled/)
  assert.match(state.message ?? "", /will not run/)
})

test("not_found maps to the shared honest not-found error for both decisions", () => {
  for (const decision of ["approved", "rejected"] as const) {
    const state = resolveOutcomeToState({ outcome: "not_found" }, decision)
    assert.equal(state.status, "error")
    assert.equal(state.message, TASK_CENTER_ACTION_NOT_FOUND_MESSAGE)
  }
})

test("invalid_state (CAS lost / already decided) is info, never success", () => {
  for (const decision of ["approved", "rejected"] as const) {
    const state = resolveOutcomeToState({ outcome: "invalid_state", taskId: "t-3", status: "queued" }, decision)
    assert.equal(state.status, "info")
    assert.equal(state.message, TASK_CENTER_INVALID_STATE_MESSAGE)
  }
})

test("approve + failed surfaces the execution failure honestly", () => {
  const state = resolveOutcomeToState(
    { outcome: "failed", taskId: "t-4", errorCode: "EXTERNAL_ACTION_UNCONFIGURED", errorMessage: "External action adapter is not configured." },
    "approved",
  )
  assert.equal(state.status, "error")
  assert.match(state.message ?? "", /approved, but execution failed/)
  assert.match(state.message ?? "", /not configured/)
})

test("reject + failed maps to error without claiming rejection happened", () => {
  const state = resolveOutcomeToState(
    { outcome: "failed", taskId: "t-5", errorCode: "X", errorMessage: "boom" },
    "rejected",
  )
  assert.equal(state.status, "error")
})

test("the unexpected approve+cancelled edge is info, never a false success", () => {
  const state = resolveOutcomeToState({ outcome: "cancelled", taskId: "t-6" }, "approved")
  assert.equal(state.status, "info")
  assert.match(state.message ?? "", /closed without running/)
})

// ─── Run outcome mapping ────────────────────────────────────────────────────

test("run + succeeded claims completion only when the task actually finished", () => {
  const state = runOutcomeToState(
    { outcome: "succeeded", taskId: "t-7", result: { summary: "", report: "", findings: {}, stepOutcomes: [] } },
  )
  assert.equal(state.status, "success")
  assert.match(state.message ?? "", /ran to completion/)
})

test("run + failed surfaces error code and message", () => {
  const state = runOutcomeToState(
    { outcome: "failed", taskId: "t-8", errorCode: OPS_ASSISTANT_ERROR_CODES.noPlan, errorMessage: "Task has no plan." },
  )
  assert.equal(state.status, "error")
  assert.match(state.message ?? "", /Task has no plan\./)
  assert.match(state.message ?? "", /AGENT_TASK_NO_PLAN/)
})

test("run + invalid_state never claims execution happened", () => {
  const state = runOutcomeToState({ outcome: "invalid_state", taskId: "t-9", status: "running" })
  assert.equal(state.status, "info")
  assert.match(state.message ?? "", /\(running\)/)
  assert.match(state.message ?? "", /Nothing was executed\./)
})

test("run + awaiting_approval points to the owner/admin gate", () => {
  const state = runOutcomeToState({ outcome: "awaiting_approval", taskId: "t-10" })
  assert.equal(state.status, "info")
  assert.match(state.message ?? "", /owner or admin approval/)
})

test("run + not_found maps to the shared not-found error", () => {
  const state = runOutcomeToState({ outcome: "not_found" })
  assert.equal(state.status, "error")
  assert.equal(state.message, TASK_CENTER_ACTION_NOT_FOUND_MESSAGE)
})

// ─── Control eligibility ────────────────────────────────────────────────────

test("approval controls only for pending tasks, approver roles, confirmed persistence", () => {
  const pending = { approvalState: "pending" as const }
  assert.equal(canShowApprovalControls(pending, { canApprove: true, persistence: "available" }), true)
  assert.equal(canShowApprovalControls(pending, { canApprove: false, persistence: "available" }), false)
  assert.equal(canShowApprovalControls(pending, { canApprove: true, persistence: "blocked" }), false)
  assert.equal(canShowApprovalControls(pending, { canApprove: true, persistence: "unknown" }), false)
  assert.equal(canShowApprovalControls({ approvalState: "approved" }, { canApprove: true, persistence: "available" }), false)
  assert.equal(canShowApprovalControls({ approvalState: "none" }, { canApprove: true, persistence: "available" }), false)
  assert.equal(canShowApprovalControls({ approvalState: "rejected" }, { canApprove: true, persistence: "available" }), false)
})

test("run control only for queued tasks with a satisfied gate, write roles, confirmed persistence", () => {
  const opts = { canWrite: true, persistence: "available" as const }
  assert.equal(canShowRunControl({ status: "queued", approvalState: "none" }, opts), true)
  assert.equal(canShowRunControl({ status: "queued", approvalState: "approved" }, opts), true)
  assert.equal(canShowRunControl({ status: "queued", approvalState: "pending" }, opts), false)
  assert.equal(canShowRunControl({ status: "running", approvalState: "none" }, opts), false)
  assert.equal(canShowRunControl({ status: "succeeded", approvalState: "none" }, opts), false)
  assert.equal(canShowRunControl({ status: "failed", approvalState: "none" }, opts), false)
  assert.equal(canShowRunControl({ status: "cancelled", approvalState: "none" }, opts), false)
  assert.equal(
    canShowRunControl({ status: "queued", approvalState: "none" }, { canWrite: false, persistence: "available" }),
    false,
  )
  assert.equal(
    canShowRunControl({ status: "queued", approvalState: "none" }, { canWrite: true, persistence: "blocked" }),
    false,
  )
  assert.equal(
    canShowRunControl({ status: "queued", approvalState: "none" }, { canWrite: true, persistence: "unknown" }),
    false,
  )
})

test("blocking constants exist and never claim completion", () => {
  assert.match(TASK_CENTER_ACTION_BLOCKED_MESSAGE, /B1/)
  assert.match(TASK_CENTER_ACTION_BLOCKED_MESSAGE, /Nothing changed\./)
  assert.match(TASK_CENTER_REJECT_FAILED_MESSAGE, /nothing was changed/i)
  assert.match(TASK_CENTER_RUN_FAILED_MESSAGE, /nothing was executed/i)
  assert.match(TASK_CENTER_AWAITING_APPROVER_NOTE, /owner or admin/)
})

test("isPersistenceUnavailableError stays narrow (control failures reuse it unchanged)", () => {
  assert.equal(isPersistenceUnavailableError({ code: "PGRST205" }), true)
  assert.equal(isPersistenceUnavailableError({ code: "42P01" }), true)
  assert.equal(isPersistenceUnavailableError({ code: "XX000", message: "crash" }), false)
})

// ─── Orchestrator transitions behind the controls (gap coverage) ────────────

test("approving a task that is not pending is refused (queued+none cannot be approved)", async () => {
  const { deps, fake } = makeDeps()
  const started = await startAgentTask({ title: "Weekly", objective: "Write a weekly status report" }, CTX, deps)
  assert.equal(started.outcome, "planned")
  const taskId = (started as { taskId: string }).taskId
  const approved = await resolveAgentApproval(taskId, "approved", CTX, deps)
  assert.equal(approved.outcome, "invalid_state")
  assert.equal(fake.tables[AGENT_TASK_TABLE][0].approval_state, "none")
})

test("rejecting a finished task is refused (terminal states are immutable via approval)", async () => {
  const { deps, fake } = makeDeps()
  const started = await startAgentTask({ title: "Weekly", objective: "Write a weekly status report" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  await executeAgentTask(taskId, CTX, deps)
  const rejected = await resolveAgentApproval(taskId, "rejected", CTX, deps)
  assert.equal(rejected.outcome, "invalid_state")
  assert.equal(fake.tables[AGENT_TASK_TABLE][0].status, "succeeded")
})

test("approval decisions are organization-isolated (another org sees not_found)", async () => {
  const { deps, fake } = makeDeps()
  // A pending, approval-gated task whose plan has no consequential steps, so
  // approval succeeds with the default (unconfigured) external adapter.
  seedTask(fake, {
    id: "iso-001",
    approval_state: "pending",
    requires_approval: true,
    objective: "Write a weekly status report",
  })
  const decided = await resolveAgentApproval("iso-001", "approved", CTX, deps)
  assert.equal(decided.outcome, "succeeded")
  // A different organization cannot resolve (or even see) the task.
  const foreign = await resolveAgentApproval("iso-001", "rejected", { ...CTX, organizationId: ORG_B }, deps)
  assert.equal(foreign.outcome, "not_found")
  const foreignRun = await executeAgentTask("iso-001", { ...CTX, organizationId: ORG_B }, deps)
  assert.equal(foreignRun.outcome, "not_found")
  const foreignCancel = await cancelAgentTask("iso-001", { ...CTX, organizationId: ORG_B }, deps)
  assert.equal(foreignCancel.outcome, "not_found")
})

test("a repeated rejection is refused (duplicate-click protection)", async () => {
  const { deps, fake } = makeDeps()
  const started = await startAgentTask({ title: "Reply", objective: "Send a follow-up email to the lead" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const first = await resolveAgentApproval(taskId, "rejected", CTX, deps)
  const second = await resolveAgentApproval(taskId, "rejected", CTX, deps)
  assert.equal(first.outcome, "cancelled")
  assert.equal(second.outcome, "invalid_state")
  const events = fake.tables[AGENT_TASK_EVENT_TABLE].filter((e) => e.task_id === taskId)
  assert.equal(events.filter((e) => e.event_type === "agent.task.approval_rejected").length, 1)
})

test("explicit Run executes an already-approved queued task to success", async () => {
  const { deps, fake } = makeDeps()
  seedTask(fake, { approval_state: "approved", requires_approval: true })
  const executed = await executeAgentTask("seeded-001", CTX, deps)
  assert.equal(executed.outcome, "succeeded")
  assert.equal(fake.tables[AGENT_TASK_TABLE][0].status, "succeeded")
  assert.ok(typeof fake.tables[AGENT_TASK_TABLE][0].completed_at === "string")
})

test("explicit Run on a queued task with no plan fails honestly (never claims success)", async () => {
  const { deps, fake } = makeDeps()
  seedTask(fake, { plan: null })
  const executed = await executeAgentTask("seeded-001", CTX, deps)
  assert.equal(executed.outcome, "failed")
  if (executed.outcome === "failed") {
    assert.equal(executed.errorCode, OPS_ASSISTANT_ERROR_CODES.noPlan)
  }
  // Pre-existing behaviour: the no-plan check fails the request BEFORE any
  // claim, so the stored row is untouched (still queued) — nothing ran.
  assert.equal(fake.tables[AGENT_TASK_TABLE][0].status, "queued")
})

test("explicit Run on a running task is refused as invalid_state", async () => {
  const { deps, fake } = makeDeps()
  seedTask(fake, { status: "running", started_at: NOW().toISOString() })
  const executed = await executeAgentTask("seeded-001", CTX, deps)
  assert.equal(executed.outcome, "invalid_state")
  assert.equal(fake.tables[AGENT_TASK_TABLE][0].status, "running")
})

test("default (unconfigured) wiring never performs external side effects on approve", async () => {
  const { deps, fake } = makeDeps()
  const started = await startAgentTask({ title: "Reply", objective: "Send a follow-up email to the lead" }, CTX, deps)
  const taskId = (started as { taskId: string }).taskId
  const approved = await resolveAgentApproval(taskId, "approved", CTX, deps)
  assert.equal(approved.outcome, "failed")
  if (approved.outcome === "failed") {
    assert.equal(approved.errorCode, "EXTERNAL_ACTION_UNCONFIGURED")
  }
  // The external_action event records the ATTEMPT; no adapter was configured
  // to perform anything, and the task honestly ends failed.
  const events = fake.tables[AGENT_TASK_EVENT_TABLE].filter((e) => e.task_id === taskId)
  assert.ok(events.some((e) => e.event_type === "agent.task.external_action"))
  assert.equal(fake.tables[AGENT_TASK_TABLE][0].status, "failed")
})

// ─── Server-action and UI boundary source inspection ────────────────────────

function readSource(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), "utf8")
}

test("control actions reuse the tested services, session identity, and role-gated wiring", () => {
  const source = readSource("src/app/dashboard/jarvis/actions.ts")
  assert.ok(source.includes('"use server"'))
  assert.ok(source.includes("getClaims"), "identity must come from session claims")
  assert.ok(source.includes("decideOpsApproval"), "must reuse the tested approval service")
  assert.ok(source.includes("executeOpsTask"), "must reuse the tested execution service")
  assert.ok(source.includes("startOpsTask"), "must keep the tested start service")
  assert.ok(source.includes("resolveOutcomeToState"))
  assert.ok(source.includes("runOutcomeToState"))
  // Forms may never supply identity or authorization fields.
  assert.ok(!/formData\.get\(["'](user|userId|organization|organizationId|org|role)["']\)/.test(source))
  assert.ok(!source.includes("SERVICE_ROLE"), "no service-role reference in the actions")
  // Missing-task-id submissions are rejected before any service call.
  assert.ok(source.includes('if (!taskId) return { status: "error"'))
})

test("actions surface only constant messages and classify persistence failures", () => {
  const source = readSource("src/app/dashboard/jarvis/actions.ts")
  assert.ok(source.includes("TASK_CENTER_CREATE_FAILED_MESSAGE"))
  assert.ok(source.includes("TASK_CENTER_APPROVE_FAILED_MESSAGE"))
  assert.ok(source.includes("TASK_CENTER_REJECT_FAILED_MESSAGE"))
  assert.ok(source.includes("TASK_CENTER_RUN_FAILED_MESSAGE"))
  assert.ok(source.includes("TASK_CENTER_ACTION_BLOCKED_MESSAGE"))
  assert.ok(source.includes("Insufficient permissions to "), "role failures from assertRole are surfaced verbatim (our own constants)")
  assert.ok(source.includes("Workspace membership not found."))
})

test("service wiring still restricts approval resolution to owner/admin", () => {
  const source = readSource("src/lib/agents/ops-assistant-service.ts")
  assert.ok(source.includes('assertRole(membership, APPROVAL_ROLES, "resolve an agent approval")'))
  assert.ok(source.includes('assertRole(membership, WRITE_ROLES, "execute an agent task")'))
})

test("client controls: hidden taskId only, pending-disabled, honest roles, eligibility helpers", () => {
  const source = readSource("src/app/dashboard/jarvis/task-actions.tsx")
  assert.ok(source.includes('"use client"'))
  assert.ok(source.includes('name="taskId"'))
  assert.ok(source.includes("disabled={anyPending}"), "duplicate-click protection client-side")
  assert.ok(source.includes('role="status"'))
  assert.ok(source.includes('role="alert"'))
  assert.ok(source.includes("canShowApprovalControls"))
  assert.ok(source.includes("canShowRunControl"))
  assert.ok(source.includes("approveJarvisTaskAction"))
  assert.ok(source.includes("rejectJarvisTaskAction"))
  assert.ok(source.includes("runJarvisTaskAction"))
  // The client never reads or renders raw error objects.
  assert.ok(!source.includes("JSON.stringify"))
  assert.ok(!source.includes("console.error"))
})

test("jarvis page wires approver role and per-row controls with the persistence gate", () => {
  const source = readSource("src/app/dashboard/jarvis/page.tsx")
  assert.ok(source.includes("canResolveAgentApproval"))
  assert.ok(source.includes("canStartAgentTask"))
  assert.ok(source.includes("TaskRowControls"))
  assert.ok(source.includes("canApprove={canApprove}"))
  assert.ok(source.includes("canWrite={canCreate}"))
  assert.ok(source.includes("persistence={persistence}"))
})

test("no self-approval rule was invented: policy gap is documented, not enforced ad hoc", () => {
  // The existing architecture defines a role boundary only. This task must
  // NOT introduce a requester-vs-approver check anywhere in the new layer.
  const actions = readSource("src/app/dashboard/jarvis/actions.ts")
  const controls = readSource("src/app/dashboard/jarvis/task-actions.tsx")
  const helpers = readSource("src/lib/agents/task-center.ts")
  for (const source of [actions, controls, helpers]) {
    assert.ok(!source.includes("createdByUserId"), "no ad-hoc self-approval rule in the control layer")
    assert.ok(!/approver.*===.*creator|creator.*===.*approver/i.test(source))
  }
  // The gap is documented in the pure helpers module.
  assert.ok(helpers.includes("no self-approval rule"))
})
