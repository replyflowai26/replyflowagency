import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  AGENT_TASK_LIST_LIMIT,
  AGENT_TASK_TABLE,
  listAgentTasks,
  normalizeStartInput,
  type AgentTaskClient,
  type OpsAssistantDeps,
} from "../src/lib/agents/ops-assistant"
import {
  TASK_CENTER_BLOCKED_MESSAGE,
  TASK_CENTER_LIST_BLOCKED_MESSAGE,
  TASK_CENTER_LIST_UNAVAILABLE_MESSAGE,
  describeApprovalBadge,
  describeTaskListState,
  describeTaskPriorityBadge,
  describeTaskStatusBadge,
  isPersistenceUnavailableError,
  startOutcomeToState,
  type TaskCenterActionState,
} from "../src/lib/agents/task-center"
import { canStartAgentTask } from "../src/lib/agents/authz"
import {
  AGENT_TASK_TITLE_MAX_LENGTH,
  isAgentTaskPriority,
  type AgentApprovalState,
  type AgentTaskStatus,
} from "../src/lib/agents/types"
import {
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_OBJECTIVE_MIN_LENGTH,
} from "../src/lib/agents/planner-core"

// ─── Minimal in-memory fake for the read side ────────────────────────────────
// Supports exactly the builder chain listAgentTasks uses:
// from().select().eq().order().limit(), awaited -> { data, error }.

const ORG = "11111111-1111-4111-8111-111111111111"
const ORG_B = "99999999-9999-4999-8999-999999999999"

type Row = Record<string, any>

function createListFake(options: { fail?: boolean } = {}) {
  const tables: Record<string, Row[]> = { [AGENT_TASK_TABLE]: [] }
  const from = (table: string) => {
    if (!tables[table]) tables[table] = []
    const filters: { col: string; val: any }[] = []
    let orderCol: string | null = null
    let orderAsc = true
    let limitCount: number | null = null
    const chain: any = {
      select: () => chain,
      eq(col: string, val: any) {
        filters.push({ col, val })
        return chain
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderCol = col
        orderAsc = opts?.ascending ?? true
        return chain
      },
      limit(n: number) {
        limitCount = n
        return chain
      },
      then(onFulfilled: any, onRejected: any) {
        return Promise.resolve()
          .then(() => {
            if (options.fail) return { data: null, error: { code: "PGRST205", message: "Could not find the table" } }
            let rows = tables[table].filter((r) => filters.every((f) => r[f.col] === f.val))
            if (orderCol) {
              rows = [...rows].sort((a, b) => {
                const cmp = String(a[orderCol as string]).localeCompare(String(b[orderCol as string]))
                return orderAsc ? cmp : -cmp
              })
            }
            if (limitCount !== null) rows = rows.slice(0, limitCount)
            return { data: rows.map((r) => ({ ...r })), error: null }
          })
          .then(onFulfilled, onRejected)
      },
    }
    return chain
  }
  return { tables, from }
}

function makeListDeps(fake: ReturnType<typeof createListFake>): OpsAssistantDeps {
  return { supabase: fake as unknown as AgentTaskClient }
}

function taskRow(overrides: Row = {}): Row {
  return {
    id: "task-001",
    organization_id: ORG,
    agent_id: "agent-row-1",
    created_by_user_id: "user-1",
    title: "Weekly pipeline report",
    objective: "Summarise captured leads for the week.",
    category: "reporting",
    priority: "normal",
    status: "queued",
    approval_state: "none",
    requires_approval: false,
    plan: null,
    result: null,
    error_code: null,
    error_message: null,
    retry_count: 0,
    max_retries: 2,
    idempotency_key: "key-1",
    last_activity_at: "2026-10-21T10:00:00.000Z",
    started_at: null,
    completed_at: null,
    created_at: "2026-10-21T10:00:00.000Z",
    ...overrides,
  }
}

// ─── listAgentTasks ──────────────────────────────────────────────────────────

test("list returns the organization's tasks, newest first", async () => {
  const fake = createListFake()
  fake.tables[AGENT_TASK_TABLE].push(taskRow({ id: "older", created_at: "2026-10-20T09:00:00.000Z" }))
  fake.tables[AGENT_TASK_TABLE].push(taskRow({ id: "newer", created_at: "2026-10-21T09:00:00.000Z" }))
  const tasks = await listAgentTasks(makeListDeps(fake), ORG)
  assert.equal(tasks.length, 2)
  assert.equal(tasks[0].id, "newer")
  assert.equal(tasks[1].id, "older")
  assert.equal(tasks[0].status, "queued")
  assert.equal(tasks[0].priority, "normal")
})

test("list never returns another organization's rows", async () => {
  const fake = createListFake()
  fake.tables[AGENT_TASK_TABLE].push(taskRow({ id: "mine" }))
  fake.tables[AGENT_TASK_TABLE].push(taskRow({ id: "theirs", organization_id: ORG_B }))
  const tasks = await listAgentTasks(makeListDeps(fake), ORG)
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].id, "mine")
})

test("list on an empty table returns an empty array (drives the empty state)", async () => {
  const fake = createListFake()
  const tasks = await listAgentTasks(makeListDeps(fake), ORG)
  assert.deepEqual(tasks, [])
})

test("list clamps the limit into [1, AGENT_TASK_LIST_LIMIT]", async () => {
  const fake = createListFake()
  for (let i = 0; i < AGENT_TASK_LIST_LIMIT + 5; i += 1) {
    fake.tables[AGENT_TASK_TABLE].push(
      taskRow({ id: `task-${String(i).padStart(3, "0")}`, created_at: `2026-10-21T10:${String(i).padStart(2, "0")}:00.000Z` }),
    )
  }
  const over = await listAgentTasks(makeListDeps(fake), ORG, { limit: 999 })
  assert.equal(over.length, AGENT_TASK_LIST_LIMIT)
  const zero = await listAgentTasks(makeListDeps(fake), ORG, { limit: 0 })
  assert.equal(zero.length, 1)
  const negative = await listAgentTasks(makeListDeps(fake), ORG, { limit: -3 })
  assert.equal(negative.length, 1)
})

test("list rejects with an honest message when the query fails (missing table)", async () => {
  const fake = createListFake({ fail: true })
  await assert.rejects(
    () => listAgentTasks(makeListDeps(fake), ORG),
    /Unable to list agent tasks/,
  )
})

// ─── Validation (the engine behind the create action) ────────────────────────

test("a valid task input is accepted and normalised", () => {
  const result = normalizeStartInput({
    title: "  Weekly pipeline report  ",
    objective: "Summarise this week's captured leads and flag decisions.",
    priority: "high",
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.title, "Weekly pipeline report")
    assert.equal(result.value.priority, "high")
  }
})

test("empty or missing title is rejected", () => {
  const empty = normalizeStartInput({ title: "   ", objective: "A long enough objective string." })
  assert.equal(empty.ok, false)
  if (!empty.ok) assert.ok(empty.errors.some((e) => e.includes("title")))
})

test(`title longer than ${AGENT_TASK_TITLE_MAX_LENGTH} characters is rejected`, () => {
  const result = normalizeStartInput({
    title: "x".repeat(AGENT_TASK_TITLE_MAX_LENGTH + 1),
    objective: "A long enough objective string.",
  })
  assert.equal(result.ok, false)
})

test("an objective shorter than the minimum is rejected", () => {
  const result = normalizeStartInput({ title: "Valid title", objective: "short" })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("objective")))
})

test("an objective at the maximum length is accepted; beyond it is rejected", () => {
  const atMax = normalizeStartInput({ title: "Valid title", objective: "a".repeat(AGENT_OBJECTIVE_MAX_LENGTH) })
  assert.equal(atMax.ok, true)
  const overMax = normalizeStartInput({ title: "Valid title", objective: "a".repeat(AGENT_OBJECTIVE_MAX_LENGTH + 1) })
  assert.equal(overMax.ok, false)
  const atMin = normalizeStartInput({ title: "Valid title", objective: "a".repeat(AGENT_OBJECTIVE_MIN_LENGTH) })
  assert.equal(atMin.ok, true)
})

test("an invalid priority is rejected, never silently coerced", () => {
  const result = normalizeStartInput({
    title: "Valid title",
    objective: "A long enough objective string.",
    priority: "asap" as any,
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("priority")))
})

// ─── startOutcomeToState ─────────────────────────────────────────────────────

test("a rejected outcome maps to an error state carrying the validation errors", () => {
  const state = startOutcomeToState({ outcome: "rejected", errors: ["title is required"] })
  assert.equal(state.status, "error")
  assert.deepEqual(state.errors, ["title is required"])
  assert.ok(state.message)
})

test("a duplicate outcome states that nothing new was created", () => {
  const state = startOutcomeToState({ outcome: "duplicate", taskId: "task-42" })
  assert.equal(state.status, "info")
  assert.equal(state.taskId, "task-42")
  assert.ok(state.message?.includes("Nothing new was created"))
})

test("a planned outcome maps to success with the task id", () => {
  const state = startOutcomeToState({
    outcome: "planned",
    taskId: "task-7",
    plan: { category: "reporting", summary: "s", steps: [], requiresApproval: false, deterministic: true, warnings: [] },
  })
  assert.equal(state.status, "success")
  assert.equal(state.taskId, "task-7")
  assert.ok(state.message?.includes("queued"))
  assert.ok(!state.message?.toLowerCase().includes("executed"))
})

test("an awaiting_approval outcome says it is queued but not executed", () => {
  const state = startOutcomeToState({
    outcome: "awaiting_approval",
    taskId: "task-9",
    plan: { category: "outreach", summary: "s", steps: [], requiresApproval: true, deterministic: true, warnings: [] },
  })
  assert.equal(state.status, "success")
  assert.ok(state.message?.includes("approval"))
})

test("a model_unavailable outcome surfaces the adapter message as an error", () => {
  const state = startOutcomeToState({ outcome: "model_unavailable", message: "No language model is configured." })
  assert.equal(state.status, "error")
  assert.equal(state.message, "No language model is configured.")
})

test("every action state message describes an outcome without claiming execution", () => {
  const states: TaskCenterActionState[] = [
    startOutcomeToState({ outcome: "rejected", errors: [] }),
    startOutcomeToState({ outcome: "duplicate", taskId: "t" }),
    startOutcomeToState({ outcome: "planned", taskId: "t", plan: { category: "general", summary: "s", steps: [], requiresApproval: false, deterministic: true, warnings: [] } }),
  ]
  for (const state of states) {
    assert.ok(state.message && state.message.length > 0)
    assert.ok(!/autonomously completed|executed by Jarvis/i.test(state.message ?? ""))
  }
})

// ─── Blocker copy and persistence classification ─────────────────────────────

test("the blocked messages name the real blocker and never claim a task exists", () => {
  for (const message of [TASK_CENTER_BLOCKED_MESSAGE, TASK_CENTER_LIST_BLOCKED_MESSAGE]) {
    assert.ok(/migration has not been applied/.test(message))
    assert.ok(/B1/.test(message) && /B2/.test(message))
  }
  assert.ok(/No task was created/.test(TASK_CENTER_BLOCKED_MESSAGE))
  assert.equal(typeof TASK_CENTER_LIST_UNAVAILABLE_MESSAGE, "string")
})

test("isPersistenceUnavailableError matches only missing-relation errors", () => {
  assert.equal(isPersistenceUnavailableError({ code: "PGRST205", message: "nope" }), true)
  assert.equal(isPersistenceUnavailableError({ code: "42P01", message: "nope" }), true)
  assert.equal(isPersistenceUnavailableError({ message: "Could not find the table 'public.ai_agent_tasks' in the schema cache" }), true)
  assert.equal(isPersistenceUnavailableError({ code: "PGRST116" }), false)
  assert.equal(isPersistenceUnavailableError({ code: "23505" }), false)
  assert.equal(isPersistenceUnavailableError(new Error("fetch failed")), false)
  assert.equal(isPersistenceUnavailableError(null), false)
  assert.equal(isPersistenceUnavailableError(undefined), false)
})

// ─── List presentation ───────────────────────────────────────────────────────

test("describeTaskListState reports a true empty state with honest copy", () => {
  const state = describeTaskListState([])
  assert.equal(state.kind, "empty")
  if (state.kind === "empty") {
    assert.ok(state.message.includes("No tasks yet"))
    assert.ok(!/migration|blocked/i.test(state.message))
  }
})

test("describeTaskListState reports the count when tasks exist", () => {
  const state = describeTaskListState([{ id: "a" }, { id: "b" }])
  assert.equal(state.kind, "available")
  if (state.kind === "available") assert.equal(state.count, 2)
})

test("status badges use the raw vocabulary, never optimistic labels", () => {
  const statuses: AgentTaskStatus[] = ["queued", "running", "succeeded", "failed", "cancelled"]
  for (const status of statuses) {
    const badge = describeTaskStatusBadge(status)
    assert.equal(badge.label.toLowerCase(), status)
    assert.ok(badge.tone.length > 0)
  }
})

test("an approval badge appears only when there is an approval to show", () => {
  assert.equal(describeApprovalBadge("none"), null)
  const pending = describeApprovalBadge("pending" as AgentApprovalState)
  assert.ok(pending)
  assert.equal(pending.label, "Approval pending")
  assert.ok(describeApprovalBadge("approved"))
  assert.ok(describeApprovalBadge("rejected"))
})

test("priority badges cover the whole supported priority set", () => {
  for (const priority of ["low", "normal", "high", "urgent"] as const) {
    assert.ok(isAgentTaskPriority(priority))
    const badge = describeTaskPriorityBadge(priority)
    assert.ok(badge.label.length > 0 && badge.tone.length > 0)
  }
})

// ─── Authorization boundary (consumed by the page and re-checked in the service)

test("viewers may read but not create; owner/admin/member may create", () => {
  assert.equal(canStartAgentTask("owner"), true)
  assert.equal(canStartAgentTask("admin"), true)
  assert.equal(canStartAgentTask("member"), true)
  assert.equal(canStartAgentTask("viewer"), false)
  assert.equal(canStartAgentTask(null), false)
  assert.equal(canStartAgentTask(undefined), false)
  assert.equal(canStartAgentTask(""), false)
})

// ─── Source-scan boundaries (server action + page wiring) ────────────────────

test("the create action is a server action that trusts only the session for identity", () => {
  const source = readFileSync(join(process.cwd(), "src/app/dashboard/jarvis/actions.ts"), "utf8")
  assert.ok(source.includes('"use server"'))
  assert.ok(source.includes("getClaims"), "identity must come from session claims")
  assert.ok(source.includes("startOpsTask"), "must reuse the existing task service")
  // The form must never be able to supply identity or tenancy fields.
  assert.ok(!/formData\.get\(["'](user|userId|organization|organizationId|org|role)["']\)/.test(source))
  assert.ok(!source.includes("SERVICE_ROLE"), "no service-role reference in the action")
})

test("the action never returns raw error internals to the browser", () => {
  const source = readFileSync(join(process.cwd(), "src/app/dashboard/jarvis/actions.ts"), "utf8")
  assert.ok(source.includes("TASK_CENTER_CREATE_FAILED_MESSAGE"), "generic honest failure message required")
  assert.ok(!/catch \(error\) \{[\s\S]*?return \{ status: "error", message: error/.test(source))
})

test("the Task Center form keeps accessible labels, disabled states and honest tones", () => {
  const source = readFileSync(join(process.cwd(), "src/app/dashboard/jarvis/task-center.tsx"), "utf8")
  assert.ok(source.includes('htmlFor="jarvis-task-title"'))
  assert.ok(source.includes('htmlFor="jarvis-task-objective"'))
  assert.ok(source.includes('htmlFor="jarvis-task-priority"'))
  assert.ok(source.includes('role="alert"'))
  assert.ok(source.includes('role="status"'))
  assert.ok(source.includes("AGENT_TASK_TITLE_MAX_LENGTH"))
  assert.ok(source.includes("disabled={disabled}"))
  assert.ok(!source.includes("SERVICE_ROLE"))
})

test("the Jarvis page wires the service list, the role gate and the honest list states", () => {
  const source = readFileSync(join(process.cwd(), "src/app/dashboard/jarvis/page.tsx"), "utf8")
  assert.ok(source.includes("listOpsTasks"))
  assert.ok(source.includes("canStartAgentTask"))
  assert.ok(source.includes("TASK_CENTER_LIST_BLOCKED_MESSAGE"))
  assert.ok(source.includes("describeTaskListState"))
  assert.ok(source.includes("<TaskCenterForm"))
})
