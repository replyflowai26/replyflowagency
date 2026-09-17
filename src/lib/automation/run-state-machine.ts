// Pure workflow-run state machine.
//
// This module has no runtime dependencies and is safe to import from tests and
// from server-only runtime modules. It defines the authoritative set of valid
// status transitions so that every state mutation is centralized and testable.
//
// The database check constraint on `workflow_runs.status` only permits the five
// statuses below, so we intentionally do NOT introduce extra states such as
// `dispatching`, `unknown` or `timed_out`. Transient conditions (a dispatch in
// flight, an uncertain external state, a timeout) are represented by the
// `running`/`queued` status combined with `error_code` and `error_message`
// fields, which the recovery and callback layers use to describe the outcome.

export const WORKFLOW_RUN_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const

export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number]

export const TERMINAL_RUN_STATUSES: readonly WorkflowRunStatus[] = [
  "succeeded",
  "failed",
  "cancelled",
]

export function isTerminalRunStatus(status: WorkflowRunStatus): boolean {
  return TERMINAL_RUN_STATUSES.includes(status)
}

// Allowed forward transitions. Anything not listed here is illegal and must be
// rejected by callers before they touch the database.
const TRANSITIONS: Record<WorkflowRunStatus, readonly WorkflowRunStatus[]> = {
  queued: ["running", "cancelled", "failed"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
}

/**
 * Returns true if moving from `from` to `to` is a legal transition.
 * Transition functions must reject illegal transitions even if a database
 * update would otherwise silently succeed.
 */
export function canTransitionRun(
  from: WorkflowRunStatus,
  to: WorkflowRunStatus,
): boolean {
  if (!isWorkerRunStatus(from) || !isWorkerRunStatus(to)) return false
  return TRANSITIONS[from].includes(to)
}

function isWorkerRunStatus(value: WorkflowRunStatus): value is WorkflowRunStatus {
  return WORKFLOW_RUN_STATUSES.includes(value)
}

// The DB check constraint is the final authority; this helper mirrors it so
// that values reaching an INSERT are validated in-process before RLS.
export function isWorkflowRunStatus(value: string): value is WorkflowRunStatus {
  return (WORKFLOW_RUN_STATUSES as readonly string[]).includes(value)
}
