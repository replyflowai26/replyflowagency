// Jarvis Task Center — pure presentation and state helpers.
//
// Dependency-free and side-effect free (type-only imports are erased at
// compile time), so the SAME module is safe to import from server components,
// the server action and the client form. Nothing here performs I/O, and no
// secret values are ever read or rendered.

import type { AgentApprovalState, AgentTaskPriority, AgentTaskStatus } from "./types"
import type {
  ExecuteAgentTaskOutcome,
  ResolveApprovalOutcome,
  StartAgentTaskOutcome,
} from "./ops-assistant"

// ─── Honest blocker copy ─────────────────────────────────────────────────────
// Task persistence lives in `ai_agent_tasks`, which is created by the agent
// runtime migration. That migration is NOT applied to staging (blocker B1 →
// B2), so the UI must say exactly that instead of pretending tasks were saved.

export const TASK_CENTER_BLOCKED_MESSAGE =
  "Task persistence is unavailable in this environment: the agent runtime migration has not been applied (staging blocker B1 → B2). No task was created."

export const TASK_CENTER_LIST_BLOCKED_MESSAGE =
  "Task history is unavailable in this environment: the agent runtime migration has not been applied (blocker B1 → B2)."

export const TASK_CENTER_LIST_UNAVAILABLE_MESSAGE =
  "Task history could not be loaded in this environment."

export const TASK_CENTER_UNVERIFIED_MESSAGE =
  "Task persistence could not be verified in this environment, so task creation is disabled until it can be confirmed."

export const TASK_CENTER_CREATE_FAILED_MESSAGE =
  "The task could not be created. The agent runtime may be unavailable in this environment; nothing was saved."

export const TASK_CENTER_ROLE_MESSAGE =
  "Your workspace role can view tasks but not create them."

// Control-layer messages (task 54). Every string is authored here — raw
// orchestrator/database error internals are never rendered.
export const TASK_CENTER_ACTION_BLOCKED_MESSAGE =
  "Task controls are unavailable in this environment: the agent runtime migration has not been applied (blocker B1 → B2). Nothing changed."

export const TASK_CENTER_APPROVE_FAILED_MESSAGE =
  "The approval could not be recorded. The agent runtime may be unavailable in this environment; nothing was changed."

export const TASK_CENTER_REJECT_FAILED_MESSAGE =
  "The rejection could not be recorded. The agent runtime may be unavailable in this environment; nothing was changed."

export const TASK_CENTER_RUN_FAILED_MESSAGE =
  "The task could not be run. The agent runtime may be unavailable in this environment; nothing was executed."

export const TASK_CENTER_ACTION_NOT_FOUND_MESSAGE =
  "Task not found. It may belong to another workspace or no longer exist."

export const TASK_CENTER_INVALID_STATE_MESSAGE =
  "The task is no longer in a state that allows this action — it may already have been decided, run or cancelled. Nothing changed."

export const TASK_CENTER_AWAITING_APPROVER_NOTE =
  "Waiting for an owner or admin to approve or reject this task."

// ─── Action state ────────────────────────────────────────────────────────────

export type TaskCenterActionStatus = "idle" | "error" | "info" | "success" | "blocked"

export type TaskCenterActionState = {
  status: TaskCenterActionStatus
  message?: string
  errors?: readonly string[]
  taskId?: string
}

/**
 * Map the orchestrator's start outcome to an honest UI state. Every branch
 * states what actually happened — a duplicate creates nothing new, an
 * approval-gated task is queued but NOT executed, and a model failure is
 * surfaced verbatim (it never contains secret values, by adapter contract).
 */
export function startOutcomeToState(outcome: StartAgentTaskOutcome): TaskCenterActionState {
  switch (outcome.outcome) {
    case "rejected":
      return {
        status: "error",
        message: "The task was not created. Fix the fields below and try again.",
        errors: outcome.errors,
      }
    case "model_unavailable":
      return { status: "error", message: outcome.message }
    case "duplicate":
      return {
        status: "info",
        taskId: outcome.taskId,
        message: `An identical objective already exists as task ${outcome.taskId}. Nothing new was created.`,
      }
    case "planned":
      return {
        status: "success",
        taskId: outcome.taskId,
        message: `Task created and queued (ID ${outcome.taskId}).`,
      }
    case "awaiting_approval":
      return {
        status: "success",
        taskId: outcome.taskId,
        message: `Task created and queued (ID ${outcome.taskId}). It is waiting for an owner or admin approval before any consequential step.`,
      }
    default: {
      const exhaustive: never = outcome
      return { status: "error", message: String(exhaustive) }
    }
  }
}

// ─── Approval / execution outcome mapping (task 54) ──────────────────────────
//
// Policy note (documented, not guessed): there is no self-approval rule
// anywhere in the existing architecture — `lead-approval-core.ts` defines a
// role boundary (owner/admin) only, and `resolveAgentApproval` performs no
// requester-vs-approver check. This layer intentionally reuses that policy
// unchanged; adding a self-approval prohibition would be a NEW product rule,
// not an implementation detail.

/**
 * Map an approval decision outcome to an honest UI state. `cancelled` is the
 * normal reject result; `succeeded` on approve means the orchestrator also
 * EXECUTED the task synchronously (see `resolveAgentApproval`), so the message
 * says both facts. A CAS-lost race surfaces as `invalid_state` → info, never
 * as success.
 */
export function resolveOutcomeToState(
  outcome: ResolveApprovalOutcome,
  decision: "approved" | "rejected",
): TaskCenterActionState {
  switch (outcome.outcome) {
    case "not_found":
      return { status: "error", message: TASK_CENTER_ACTION_NOT_FOUND_MESSAGE }
    case "invalid_state":
      return { status: "info", taskId: outcome.taskId, message: TASK_CENTER_INVALID_STATE_MESSAGE }
    case "cancelled":
      if (decision === "rejected") {
        return {
          status: "success",
          taskId: outcome.taskId,
          message: `Task ${outcome.taskId} was rejected and cancelled — it will not run.`,
        }
      }
      return {
        status: "info",
        taskId: outcome.taskId,
        message: `Task ${outcome.taskId} was closed without running.`,
      }
    case "succeeded":
      if (decision === "approved") {
        return {
          status: "success",
          taskId: outcome.taskId,
          message: `Task ${outcome.taskId} was approved and ran to completion.`,
        }
      }
      return {
        status: "info",
        taskId: outcome.taskId,
        message: `Task ${outcome.taskId} was closed.`,
      }
    case "failed":
      if (decision === "approved") {
        return {
          status: "error",
          taskId: outcome.taskId,
          message: `Task ${outcome.taskId} was approved, but execution failed: ${outcome.errorMessage}`,
        }
      }
      return {
        status: "error",
        taskId: outcome.taskId,
        message: `Task ${outcome.taskId} could not be processed: ${outcome.errorMessage}`,
      }
    default: {
      const exhaustive: never = outcome
      return { status: "error", message: String(exhaustive) }
    }
  }
}

/** Map an explicit Run-task outcome. Success means the task FINISHED, not that a request was queued. */
export function runOutcomeToState(outcome: ExecuteAgentTaskOutcome): TaskCenterActionState {
  switch (outcome.outcome) {
    case "not_found":
      return { status: "error", message: TASK_CENTER_ACTION_NOT_FOUND_MESSAGE }
    case "invalid_state":
      return {
        status: "info",
        taskId: outcome.taskId,
        message: `Task ${outcome.taskId} is not runnable in its current state (${outcome.status}) — it may already be running or finished. Nothing was executed.`,
      }
    case "awaiting_approval":
      return {
        status: "info",
        taskId: outcome.taskId,
        message: `Task ${outcome.taskId} is waiting for an owner or admin approval before it can run.`,
      }
    case "succeeded":
      return {
        status: "success",
        taskId: outcome.taskId,
        message: `Task ${outcome.taskId} ran to completion.`,
      }
    case "failed":
      return {
        status: "error",
        taskId: outcome.taskId,
        message: `Task ${outcome.taskId} failed: ${outcome.errorMessage} (${outcome.errorCode}).`,
      }
    default: {
      const exhaustive: never = outcome
      return { status: "error", message: String(exhaustive) }
    }
  }
}

// ─── Control eligibility ─────────────────────────────────────────────────────

export type TaskPersistence = "available" | "blocked" | "unknown"

/**
 * Approve/Reject buttons appear ONLY for a pending-approval task, to an
 * approver-role viewer, when persistence is confirmed. Mirrors the server
 * boundary (`decideOpsApproval` → owner/admin; `queued+pending` only).
 */
export function canShowApprovalControls(
  task: { approvalState: AgentApprovalState },
  options: { canApprove: boolean; persistence: TaskPersistence },
): boolean {
  return (
    options.persistence === "available" &&
    options.canApprove &&
    task.approvalState === "pending"
  )
}

/**
 * The explicit Run control appears ONLY for a queued task whose approval gate
 * is satisfied (`none` or `approved`), to a write-role viewer, when persistence
 * is confirmed. Running stays an explicit human action — nothing runs
 * automatically.
 */
export function canShowRunControl(
  task: { status: AgentTaskStatus; approvalState: AgentApprovalState },
  options: { canWrite: boolean; persistence: TaskPersistence },
): boolean {
  return (
    options.persistence === "available" &&
    options.canWrite &&
    task.status === "queued" &&
    (task.approvalState === "none" || task.approvalState === "approved")
  )
}

// ─── Persistence-blocker detection ───────────────────────────────────────────

const MISSING_RELATION_CODES = new Set(["PGRST205", "42P01"])
const MISSING_RELATION_MESSAGE = /could not find the table|does not exist/i

/** True only for "relation does not exist" errors — never for other failures. */
export function isPersistenceUnavailableError(error: unknown): boolean {
  const record = error as { code?: unknown; message?: unknown } | null | undefined
  const code = typeof record?.code === "string" ? record.code : null
  if (code && MISSING_RELATION_CODES.has(code)) return true
  const message = typeof record?.message === "string" ? record.message : ""
  return MISSING_RELATION_MESSAGE.test(message)
}

// ─── List presentation ───────────────────────────────────────────────────────

export type TaskBadge = { label: string; tone: string }

const STATUS_TONE: Record<AgentTaskStatus, string> = {
  queued: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  running: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  succeeded: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  failed: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  cancelled: "border-white/15 bg-white/[.04] text-white/50",
}

const PRIORITY_TONE: Record<AgentTaskPriority, string> = {
  low: "border-white/10 bg-white/[.03] text-white/60",
  normal: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  high: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  urgent: "border-rose-300/30 bg-rose-300/10 text-rose-100",
}

/** Honest status badge — raw vocabulary only, never optimistic relabelling. */
export function describeTaskStatusBadge(status: AgentTaskStatus): TaskBadge {
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return { label, tone: STATUS_TONE[status] ?? "border-white/15 bg-white/[.04] text-white/50" }
}

/** Approval badge only when there is an approval axis to show. */
export function describeApprovalBadge(
  approvalState: AgentApprovalState,
): TaskBadge | null {
  switch (approvalState) {
    case "pending":
      return { label: "Approval pending", tone: "border-amber-300/30 bg-amber-300/10 text-amber-100" }
    case "approved":
      return { label: "Approved", tone: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" }
    case "rejected":
      return { label: "Approval rejected", tone: "border-rose-300/30 bg-rose-300/10 text-rose-100" }
    case "none":
    default:
      return null
  }
}

export function describeTaskPriorityBadge(priority: AgentTaskPriority): TaskBadge {
  const label = priority.charAt(0).toUpperCase() + priority.slice(1)
  return { label, tone: PRIORITY_TONE[priority] ?? "border-white/10 bg-white/[.03] text-white/60" }
}

export type TaskListState =
  | { kind: "empty"; message: string }
  | { kind: "available"; count: number }

/**
 * Decide what an empty task table means. Called ONLY after persistence was
 * confirmed available — a missing table is a blocker message, never "no tasks".
 */
export function describeTaskListState(
  tasks: readonly { id: string }[],
): TaskListState {
  if (tasks.length === 0) {
    return {
      kind: "empty",
      message:
        "No tasks yet. Create the first task above — Jarvis plans every task with an allowlisted toolset and waits for approval before anything consequential.",
    }
  }
  return { kind: "available", count: tasks.length }
}
