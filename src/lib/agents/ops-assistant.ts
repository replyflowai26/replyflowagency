// Operations Assistant orchestrator (dependency-injected, deterministic).
//
// This is the testable vertical slice of the first internal agent. It mirrors
// the established pattern from `lead-capture-run.ts` and `callback-apply.ts`: a
// pure orchestrator that performs its Supabase operations through an INJECTED
// structural client, so it can be unit-tested against an in-memory fake with
// zero database writes, and production wiring supplies the real admin client.
//
// Reuse, not duplication:
// - Task status uses the existing workflow-run vocabulary (queued/running/
//   succeeded/failed/cancelled) via `AgentTaskStatus`. There is NO second queue
//   and NO dispatcher: the agent executes in-process, deterministically.
// - The human approval gate mirrors the durable `approval_state` axis.
// - Every state change is a guarded compare-and-set (`.eq("status", expected)`)
//   so concurrent actors serialize and the loser writes nothing.
// - The model and external-action seams default to deterministic/unconfigured.

import { createHash, randomUUID } from "node:crypto"

import type {
  AgentApprovalState,
  AgentPlan,
  AgentStepOutcome,
  AgentTask,
  AgentTaskCategory,
  AgentTaskPriority,
  AgentTaskResult,
  AgentTaskStatus,
} from "./types"
import { isAgentTaskPriority, AGENT_TASK_TITLE_MAX_LENGTH } from "./types"
import { validateObjective } from "./planner-core"
import {
  createDeterministicToolExecutor,
  isAllowlistedTool,
  type AgentToolContext,
  type AgentToolExecutor,
} from "./tools"
import {
  createDeterministicModelAdapter,
  type AgentModelAdapter,
} from "./model-adapter"
import {
  createUnconfiguredExternalActionAdapter,
  type ExternalActionAdapter,
} from "./external-action-adapter"
import { buildTaskMemory } from "./memory-core"
import { ensureAgentIdentity } from "./agent-identity"

// The orchestrator only needs `from(table)`; the real admin client satisfies it
// structurally and tests substitute an in-memory fake.
export type AgentTaskClient = {
  from: (table: string) => any
}

export type AgentLogger = (
  level: "error" | "warn" | "info",
  scope: string,
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>,
) => void

export type OpsAssistantDeps = {
  supabase: AgentTaskClient
  /** Model seam. Defaults to the deterministic planner (no LLM). */
  model?: AgentModelAdapter
  /** Internal tool executor. Defaults to the deterministic pure executor. */
  tools?: AgentToolExecutor
  /** Consequential-action seam. Defaults to unconfigured (fails honestly). */
  external?: ExternalActionAdapter
  /** Injectable for deterministic ids/timestamps in tests. */
  newId?: () => string
  now?: () => Date
  log?: AgentLogger
}

export type OpsAssistantContext = {
  organizationId: string
  agentId: string
  createdByUserId: string
  /**
   * The authenticated human acting on this call. On approval paths this is the
   * approver whose decision is recorded in the audit event
   * (`decided_by_user_id`), so every consequential decision is attributable.
   * Optional for backwards compatibility: non-authenticated paths (tests,
   * demos) omit it and the event honestly records `null`.
   */
  actorUserId?: string | null
}

export type StartAgentTaskInput = {
  title: string
  objective: string
  priority?: AgentTaskPriority
  idempotencyKey?: string
  knowledge?: readonly string[]
  data?: Record<string, unknown>
  maxRetries?: number
}

export type StartAgentTaskOutcome =
  | { outcome: "rejected"; errors: readonly string[] }
  | { outcome: "model_unavailable"; message: string }
  | { outcome: "duplicate"; taskId: string }
  | { outcome: "planned"; taskId: string; plan: AgentPlan }
  | { outcome: "awaiting_approval"; taskId: string; plan: AgentPlan }

export type ExecuteAgentTaskOutcome =
  | { outcome: "not_found" }
  | { outcome: "invalid_state"; taskId: string; status: string }
  | { outcome: "awaiting_approval"; taskId: string }
  | { outcome: "succeeded"; taskId: string; result: AgentTaskResult }
  | { outcome: "failed"; taskId: string; errorCode: string; errorMessage: string }

export type ResolveApprovalOutcome =
  | { outcome: "not_found" }
  | { outcome: "invalid_state"; taskId: string; status: string }
  | { outcome: "cancelled"; taskId: string }
  | { outcome: "succeeded"; taskId: string; result: AgentTaskResult }
  | { outcome: "failed"; taskId: string; errorCode: string; errorMessage: string }

export type CancelAgentTaskOutcome =
  | { outcome: "not_found" }
  | { outcome: "invalid_state"; taskId: string; status: string }
  | { outcome: "cancelled"; taskId: string }

export const AGENT_TASK_TABLE = "ai_agent_tasks"
export const AGENT_TASK_EVENT_TABLE = "ai_agent_task_events"
export const AGENT_MEMORY_TABLE = "ai_agent_memory"

export const OPS_ASSISTANT_ERROR_CODES = {
  validation: "AGENT_TASK_INVALID",
  toolFailed: "AGENT_TOOL_FAILED",
  toolNotAllowlisted: "AGENT_TOOL_NOT_ALLOWLISTED",
  externalFailed: "AGENT_EXTERNAL_ACTION_FAILED",
  claimFailed: "AGENT_TASK_CLAIM_FAILED",
  noPlan: "AGENT_TASK_NO_PLAN",
} as const

export const OPS_ASSISTANT_EVENTS = {
  planned: "agent.task.planned",
  approvalRequired: "agent.task.approval_required",
  approvalGranted: "agent.task.approval_granted",
  approvalRejected: "agent.task.approval_rejected",
  executing: "agent.task.executing",
  externalAction: "agent.task.external_action",
  retry: "agent.task.retry",
  succeeded: "agent.task.succeeded",
  failed: "agent.task.failed",
  cancelled: "agent.task.cancelled",
} as const

// One source of truth for the title bound, shared with the Task Center UI.
const MAX_TITLE_LENGTH = AGENT_TASK_TITLE_MAX_LENGTH
const DEFAULT_MAX_RETRIES = 2
const MAX_MAX_RETRIES = 5

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isUniqueViolation(error: unknown): boolean {
  return isRecord(error) && error.code === "23505"
}

function taskIdempotencyKey(agentId: string, objective: string): string {
  return createHash("sha256").update(`${agentId}:${objective}`).digest("hex")
}

function rowToTask(row: Record<string, unknown>): AgentTask {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    agentId: String(row.agent_id),
    createdByUserId: String(row.created_by_user_id ?? ""),
    title: String(row.title ?? ""),
    objective: String(row.objective ?? ""),
    category: String(row.category ?? "general") as AgentTaskCategory,
    priority: String(row.priority ?? "normal") as AgentTaskPriority,
    status: String(row.status ?? "queued") as AgentTaskStatus,
    approvalState: String(row.approval_state ?? "none") as AgentApprovalState,
    requiresApproval: Boolean(row.requires_approval),
    plan: isRecord(row.plan) ? (row.plan as unknown as AgentPlan) : null,
    result: isRecord(row.result) ? (row.result as unknown as AgentTaskResult) : null,
    errorCode: typeof row.error_code === "string" ? row.error_code : null,
    errorMessage: typeof row.error_message === "string" ? row.error_message : null,
    retryCount: typeof row.retry_count === "number" ? row.retry_count : 0,
    maxRetries: typeof row.max_retries === "number" ? row.max_retries : DEFAULT_MAX_RETRIES,
    idempotencyKey: typeof row.idempotency_key === "string" ? row.idempotency_key : null,
    lastActivityAt: String(row.last_activity_at ?? ""),
    startedAt: typeof row.started_at === "string" ? row.started_at : null,
    completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
    createdAt: String(row.created_at ?? ""),
  }
}

async function appendEvent(
  deps: OpsAssistantDeps,
  organizationId: string,
  taskId: string,
  eventType: string,
  message: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await deps.supabase.from(AGENT_TASK_EVENT_TABLE).insert({
    organization_id: organizationId,
    task_id: taskId,
    event_type: eventType,
    message,
    payload,
  })
  if (error) {
    ;(deps.log ?? (() => {}))("error", "agent.task.event", "Unable to record agent task event.", error, {
      organization_id: organizationId,
      task_id: taskId,
      event_type: eventType,
    })
  }
}

async function loadTask(
  deps: OpsAssistantDeps,
  context: OpsAssistantContext,
  taskId: string,
): Promise<AgentTask | null> {
  const { data, error } = await deps.supabase
    .from(AGENT_TASK_TABLE)
    .select("*")
    .eq("id", taskId)
    .eq("organization_id", context.organizationId)
    .maybeSingle()
  if (error) throw new Error("Unable to load agent task.")
  return data ? rowToTask(data as Record<string, unknown>) : null
}

// Guarded compare-and-set on the task's live status. Returns the row id when the
// update matched, null when the predicate did not match (lost race / wrong
// state). Never throws on a zero-row match.
async function casTask(
  deps: OpsAssistantDeps,
  context: OpsAssistantContext,
  patch: Record<string, unknown>,
  predicate: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  let query = deps.supabase.from(AGENT_TASK_TABLE).update(patch).eq("organization_id", context.organizationId)
  for (const [key, value] of Object.entries(predicate)) {
    query = query.eq(key, value)
  }
  const { data, error } = await query.select("id").maybeSingle()
  if (error) throw new Error("Unable to update agent task.")
  return data ?? null
}

export function normalizeStartInput(input: StartAgentTaskInput): {
  ok: true
  value: {
    title: string
    objective: string
    priority: AgentTaskPriority
    idempotencyKey: string | null
    knowledge: readonly string[]
    data: Record<string, unknown>
    maxRetries: number
  }
} | { ok: false; errors: readonly string[] } {
  const errors: string[] = []
  const title = typeof input.title === "string" ? input.title.trim() : ""
  if (title.length === 0) errors.push("title is required")
  if (title.length > MAX_TITLE_LENGTH) errors.push(`title must be at most ${MAX_TITLE_LENGTH} characters`)

  const objective = validateObjective(input.objective)
  if (!objective.ok) errors.push(...objective.errors)

  const priority = input.priority ?? "normal"
  if (!isAgentTaskPriority(priority)) errors.push("priority is invalid")

  const knowledge = Array.isArray(input.knowledge)
    ? input.knowledge.filter((entry): entry is string => typeof entry === "string").slice(0, 20)
    : []
  const data = isRecord(input.data) ? input.data : {}

  const requestedRetries = typeof input.maxRetries === "number" ? Math.floor(input.maxRetries) : DEFAULT_MAX_RETRIES
  const maxRetries = Math.max(0, Math.min(MAX_MAX_RETRIES, requestedRetries))

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      title,
      objective: (objective as { ok: true; objective: string }).objective,
      priority: priority as AgentTaskPriority,
      idempotencyKey: typeof input.idempotencyKey === "string" && input.idempotencyKey.trim() ? input.idempotencyKey.trim() : null,
      knowledge,
      data,
      maxRetries,
    },
  }
}

function sanitizePlan(plan: AgentPlan): AgentPlan {
  const steps = plan.steps.filter((step) => isAllowlistedTool(step.tool))
  const dropped = plan.steps.length - steps.length
  return {
    ...plan,
    steps,
    requiresApproval: steps.some((step) => step.consequential),
    warnings: dropped > 0 ? [...plan.warnings, `${dropped} non-allowlisted step(s) were dropped.`] : plan.warnings,
  }
}

export async function startAgentTask(
  input: StartAgentTaskInput,
  context: OpsAssistantContext,
  deps: OpsAssistantDeps,
): Promise<StartAgentTaskOutcome> {
  const normalized = normalizeStartInput(input)
  if (!normalized.ok) return { outcome: "rejected", errors: normalized.errors }
  const value = normalized.value

  // The idempotency hash uses the STABLE LOGICAL agent id (not the per-org
  // uuid row id), so a duplicate objective is recognised regardless of which
  // identity row exists; uniqueness is still scoped by organization_id in the
  // table constraint and in the queries below.
  const idempotencyKey = value.idempotencyKey ?? taskIdempotencyKey(context.agentId, value.objective)

  // Idempotency pre-check.
  const { data: existing, error: existingError } = await deps.supabase
    .from(AGENT_TASK_TABLE)
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
  if (existingError) throw new Error("Unable to check for an existing agent task.")
  if (existing && typeof existing.id === "string") {
    return { outcome: "duplicate", taskId: existing.id }
  }

  const model = deps.model ?? createDeterministicModelAdapter()
  const modelResult = await model.plan({ objective: value.objective })
  if (!modelResult.ok) {
    if (modelResult.reason === "invalid") {
      return { outcome: "rejected", errors: [modelResult.message] }
    }
    return { outcome: "model_unavailable", message: modelResult.message }
  }

  const plan = sanitizePlan(modelResult.plan)
  const now = deps.now ?? (() => new Date())
  const newId = deps.newId ?? (() => randomUUID())
  const taskId = newId()
  const timestamp = now().toISOString()
  const approvalState: AgentApprovalState = plan.requiresApproval ? "pending" : "none"

  // ai_agent_tasks.agent_id is a uuid FK to ai_agents(id, organization_id):
  // resolve the logical context.agentId to the organization's identity row
  // (creating it on first use) instead of writing the logical id itself.
  // Runs only once the task is validated, non-duplicate and plannable, so a
  // failed start never leaves a stray identity row behind.
  const agentRowId = await ensureAgentIdentity(deps, context)

  const { error: insertError } = await deps.supabase.from(AGENT_TASK_TABLE).insert({
    id: taskId,
    organization_id: context.organizationId,
    agent_id: agentRowId,
    created_by_user_id: context.createdByUserId,
    title: value.title,
    objective: value.objective,
    category: plan.category,
    priority: value.priority,
    status: "queued",
    approval_state: approvalState,
    requires_approval: plan.requiresApproval,
    plan,
    result: null,
    error_code: null,
    error_message: null,
    retry_count: 0,
    max_retries: value.maxRetries,
    idempotency_key: idempotencyKey,
    last_activity_at: timestamp,
    started_at: null,
    completed_at: null,
    created_at: timestamp,
  })

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      const { data: raced } = await deps.supabase
        .from(AGENT_TASK_TABLE)
        .select("id")
        .eq("organization_id", context.organizationId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle()
      if (raced && typeof raced.id === "string") return { outcome: "duplicate", taskId: raced.id }
    }
    throw new Error("Unable to create agent task.")
  }

  await appendEvent(deps, context.organizationId, taskId, OPS_ASSISTANT_EVENTS.planned, "Task planned.", {
    category: plan.category,
    deterministic: plan.deterministic,
    steps: plan.steps.length,
    requires_approval: plan.requiresApproval,
  })

  if (plan.requiresApproval) {
    await appendEvent(
      deps,
      context.organizationId,
      taskId,
      OPS_ASSISTANT_EVENTS.approvalRequired,
      "Task requires human approval before any consequential step.",
      { role: "owner", category: plan.category },
    )
    return { outcome: "awaiting_approval", taskId, plan }
  }

  return { outcome: "planned", taskId, plan }
}

function buildToolContext(task: AgentTask, input: { knowledge: readonly string[]; data: Record<string, unknown> }): AgentToolContext {
  return { objective: task.objective, knowledge: input.knowledge, data: input.data }
}

type StepRun =
  | { ok: true; outcome: AgentStepOutcome; output: Record<string, unknown> }
  | { ok: false; outcome: AgentStepOutcome; errorCode: string; errorMessage: string }

export async function executeAgentTask(
  taskId: string,
  context: OpsAssistantContext,
  deps: OpsAssistantDeps,
  options: { knowledge?: readonly string[]; data?: Record<string, unknown> } = {},
): Promise<ExecuteAgentTaskOutcome> {
  const task = await loadTask(deps, context, taskId)
  if (!task) return { outcome: "not_found" }

  if (task.status === "succeeded" || task.status === "failed" || task.status === "cancelled") {
    return { outcome: "invalid_state", taskId, status: task.status }
  }
  if (task.approvalState === "pending") {
    return { outcome: "awaiting_approval", taskId }
  }
  if (task.requiresApproval && task.approvalState !== "approved") {
    return { outcome: "awaiting_approval", taskId }
  }
  if (!task.plan) {
    return { outcome: "failed", taskId, errorCode: OPS_ASSISTANT_ERROR_CODES.noPlan, errorMessage: "Task has no plan." }
  }

  const tools = deps.tools ?? createDeterministicToolExecutor()
  const external = deps.external ?? createUnconfiguredExternalActionAdapter()
  const now = deps.now ?? (() => new Date())

  // Claim: queued -> running (compare-and-set).
  const claimed = await casTask(
    deps,
    context,
    { status: "running", started_at: task.startedAt ?? now().toISOString(), last_activity_at: now().toISOString(), error_code: null, error_message: null },
    { id: taskId, status: "queued" },
  )
  if (!claimed) return { outcome: "invalid_state", taskId, status: task.status }

  await appendEvent(deps, context.organizationId, taskId, OPS_ASSISTANT_EVENTS.executing, "Task execution started.", {
    category: task.category,
  })

  const toolContext = buildToolContext(task, { knowledge: options.knowledge ?? [], data: options.data ?? {} })
  const stepOutcomes: AgentStepOutcome[] = []
  const findings: Record<string, unknown> = {}

  for (const step of task.plan.steps) {
    // Mid-run cancellation check.
    const current = await loadTask(deps, context, taskId)
    if (!current || current.status === "cancelled") {
      return { outcome: "invalid_state", taskId, status: "cancelled" }
    }

    const run = step.consequential
      ? await runConsequentialStep(deps, context, task, step, external, now)
      : await runInternalStep(deps, context, task, step, tools, toolContext, now)

    stepOutcomes.push(run.outcome)

    if (!run.ok) {
      await failTask(deps, context, taskId, run.errorCode, run.errorMessage, stepOutcomes, now)
      return { outcome: "failed", taskId, errorCode: run.errorCode, errorMessage: run.errorMessage }
    }
    findings[step.id] = run.output
  }

  const result = composeResult(task, findings, stepOutcomes)
  const settled = await casTask(
    deps,
    context,
    { status: "succeeded", result, completed_at: now().toISOString(), last_activity_at: now().toISOString() },
    { id: taskId, status: "running" },
  )
  if (!settled) return { outcome: "invalid_state", taskId, status: "running" }

  await appendEvent(deps, context.organizationId, taskId, OPS_ASSISTANT_EVENTS.succeeded, "Task succeeded.", {
    category: task.category,
    steps: stepOutcomes.length,
  })
  await storeTaskMemory(deps, context, task, result, now)
  return { outcome: "succeeded", taskId, result }
}

async function runInternalStep(
  deps: OpsAssistantDeps,
  context: OpsAssistantContext,
  task: AgentTask,
  step: AgentPlan["steps"][number],
  tools: AgentToolExecutor,
  toolContext: AgentToolContext,
  now: () => Date,
): Promise<StepRun> {
  let attempt = 0
  // Internal, deterministic tools are retried up to the task's limit.
  for (;;) {
    const result = tools(step.tool, toolContext)
    if (result.ok) {
      return {
        ok: true,
        output: result.output,
        outcome: { stepId: step.id, tool: step.tool, ok: true, detail: result.summary, consequential: false },
      }
    }
    if (attempt >= task.maxRetries) {
      return {
        ok: false,
        errorCode: result.errorCode,
        errorMessage: result.message,
        outcome: { stepId: step.id, tool: step.tool, ok: false, detail: result.message, consequential: false },
      }
    }
    attempt += 1
    await casTask(deps, context, { retry_count: attempt, last_activity_at: now().toISOString() }, { id: task.id, status: "running" })
    await appendEvent(deps, context.organizationId, task.id, OPS_ASSISTANT_EVENTS.retry, `Retrying step ${step.id}.`, {
      step: step.id,
      tool: step.tool,
      attempt,
      error_code: result.errorCode,
    })
  }
}

async function runConsequentialStep(
  deps: OpsAssistantDeps,
  context: OpsAssistantContext,
  task: AgentTask,
  step: AgentPlan["steps"][number],
  external: ExternalActionAdapter,
  now: () => Date,
): Promise<StepRun> {
  // Consequential actions are never retried automatically: a retry could
  // double-send a message or double-charge a payment.
  await appendEvent(deps, context.organizationId, task.id, OPS_ASSISTANT_EVENTS.externalAction, `Performing approved action ${step.id}.`, {
    step: step.id,
    tool: step.tool,
  })
  const result = await external.perform({
    organizationId: context.organizationId,
    taskId: task.id,
    step,
    payload: { objective: task.objective, category: task.category },
  })
  if (result.ok) {
    return {
      ok: true,
      output: { reference: result.reference, detail: result.detail },
      outcome: { stepId: step.id, tool: step.tool, ok: true, detail: result.detail, consequential: true },
    }
  }
  return {
    ok: false,
    errorCode: result.errorCode,
    errorMessage: result.message,
    outcome: { stepId: step.id, tool: step.tool, ok: false, detail: result.message, consequential: true },
  }
}

async function failTask(
  deps: OpsAssistantDeps,
  context: OpsAssistantContext,
  taskId: string,
  errorCode: string,
  errorMessage: string,
  stepOutcomes: readonly AgentStepOutcome[],
  now: () => Date,
): Promise<void> {
  await casTask(
    deps,
    context,
    { status: "failed", error_code: errorCode, error_message: errorMessage, completed_at: now().toISOString(), last_activity_at: now().toISOString() },
    { id: taskId, status: "running" },
  )
  await appendEvent(deps, context.organizationId, taskId, OPS_ASSISTANT_EVENTS.failed, errorMessage, {
    error_code: errorCode,
    steps: stepOutcomes.length,
  })
}

function composeResult(
  task: AgentTask,
  findings: Record<string, unknown>,
  stepOutcomes: readonly AgentStepOutcome[],
): AgentTaskResult {
  const reportStep = findings["step-2"] ?? findings["step-1"]
  const report =
    isRecord(reportStep) && typeof reportStep.report === "string"
      ? reportStep.report
      : isRecord(reportStep) && typeof reportStep.draft === "string"
        ? reportStep.draft
        : `${task.title}: completed ${stepOutcomes.length} step(s).`

  return {
    summary: `${task.category} task completed (${stepOutcomes.length} step(s)).`,
    report,
    findings,
    stepOutcomes,
  }
}

async function storeTaskMemory(
  deps: OpsAssistantDeps,
  context: OpsAssistantContext,
  task: AgentTask,
  result: AgentTaskResult,
  now: () => Date,
): Promise<void> {
  const entries = buildTaskMemory({
    organizationId: context.organizationId,
    // ai_agent_memory.agent_id carries the same uuid FK as the task row, so
    // memory attaches to the task's real identity row — not the logical id.
    agentId: task.agentId,
    task,
    result,
    now: now().toISOString(),
  })
  for (const entry of entries) {
    const { error } = await deps.supabase.from(AGENT_MEMORY_TABLE).insert({
      organization_id: entry.organizationId,
      agent_id: entry.agentId,
      task_id: entry.taskId,
      scope: entry.scope,
      key: entry.key,
      value: entry.value,
      created_at: entry.createdAt,
    })
    if (error) {
      ;(deps.log ?? (() => {}))("warn", "agent.task.memory", "Unable to store agent memory entry.", error, {
        organization_id: context.organizationId,
        task_id: task.id,
        scope: entry.scope,
      })
    }
  }
}

export async function resolveAgentApproval(
  taskId: string,
  decision: "approved" | "rejected",
  context: OpsAssistantContext,
  deps: OpsAssistantDeps,
  options: { knowledge?: readonly string[]; data?: Record<string, unknown> } = {},
): Promise<ResolveApprovalOutcome> {
  const task = await loadTask(deps, context, taskId)
  if (!task) return { outcome: "not_found" }
  if (task.status !== "queued" || task.approvalState !== "pending") {
    return { outcome: "invalid_state", taskId, status: task.status }
  }

  const claimed = await casTask(
    deps,
    context,
    { approval_state: decision, last_activity_at: (deps.now ?? (() => new Date()))().toISOString() },
    { id: taskId, status: "queued", approval_state: "pending" },
  )
  if (!claimed) return { outcome: "invalid_state", taskId, status: task.status }

  if (decision === "rejected") {
    const event = OPS_ASSISTANT_EVENTS.approvalRejected
    await appendEvent(deps, context.organizationId, taskId, event, "Task rejected by approver.", {
      decision,
      decided_by_user_id: context.actorUserId ?? null,
    })
    const cancelled = await casTask(
      deps,
      context,
      { status: "cancelled", completed_at: (deps.now ?? (() => new Date()))().toISOString(), last_activity_at: (deps.now ?? (() => new Date()))().toISOString() },
      { id: taskId, status: "queued" },
    )
    if (!cancelled) return { outcome: "invalid_state", taskId, status: "queued" }
    await appendEvent(deps, context.organizationId, taskId, OPS_ASSISTANT_EVENTS.cancelled, "Task cancelled after rejection.", {
      decided_by_user_id: context.actorUserId ?? null,
    })
    return { outcome: "cancelled", taskId }
  }

  await appendEvent(deps, context.organizationId, taskId, OPS_ASSISTANT_EVENTS.approvalGranted, "Task approved; proceeding.", {
    decision,
    decided_by_user_id: context.actorUserId ?? null,
  })

  const executed = await executeAgentTask(taskId, context, deps, options)
  if (executed.outcome === "succeeded") return { outcome: "succeeded", taskId, result: executed.result }
  if (executed.outcome === "failed") return { outcome: "failed", taskId, errorCode: executed.errorCode, errorMessage: executed.errorMessage }
  return { outcome: "invalid_state", taskId, status: "executed" }
}

export async function cancelAgentTask(
  taskId: string,
  context: OpsAssistantContext,
  deps: OpsAssistantDeps,
): Promise<CancelAgentTaskOutcome> {
  const task = await loadTask(deps, context, taskId)
  if (!task) return { outcome: "not_found" }
  if (task.status === "succeeded" || task.status === "failed" || task.status === "cancelled") {
    return { outcome: "invalid_state", taskId, status: task.status }
  }

  const nowIso = (deps.now ?? (() => new Date()))().toISOString()
  let cancelled = await casTask(deps, context, { status: "cancelled", completed_at: nowIso, last_activity_at: nowIso }, { id: taskId, status: "queued" })
  if (!cancelled) {
    cancelled = await casTask(deps, context, { status: "cancelled", completed_at: nowIso, last_activity_at: nowIso }, { id: taskId, status: "running" })
  }
  if (!cancelled) return { outcome: "invalid_state", taskId, status: task.status }

  await appendEvent(deps, context.organizationId, taskId, OPS_ASSISTANT_EVENTS.cancelled, "Task cancelled.", {})
  return { outcome: "cancelled", taskId }
}

// ─── Read side ───────────────────────────────────────────────────────────────

export const AGENT_TASK_LIST_LIMIT = 50

/**
 * List an organization's tasks, newest first. Read-only: the caller supplies
 * the organization it already authorized (the server wiring resolves it from
 * the caller's membership, and RLS independently scopes every row).
 */
export async function listAgentTasks(
  deps: OpsAssistantDeps,
  organizationId: string,
  options: { limit?: number } = {},
): Promise<readonly AgentTask[]> {
  const requested = Math.floor(options.limit ?? AGENT_TASK_LIST_LIMIT)
  const limit = Number.isFinite(requested)
    ? Math.max(1, Math.min(AGENT_TASK_LIST_LIMIT, requested))
    : AGENT_TASK_LIST_LIMIT
  const { data, error } = await deps.supabase
    .from(AGENT_TASK_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("Unable to list agent tasks.")
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
  return rows.map((row) => rowToTask(row))
}
