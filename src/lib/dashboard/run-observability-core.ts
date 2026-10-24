export const RUN_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const

export type RunStatus = (typeof RUN_STATUSES)[number]

export type RunStatusMeta = {
  label: string
  tone: "default" | "running" | "success" | "danger" | "muted"
  dot: string
}

export const RUN_STATUS_META: Record<RunStatus, RunStatusMeta> = {
  queued: { label: "Queued", tone: "default", dot: "bg-white/50" },
  running: { label: "Running", tone: "running", dot: "bg-cyan-300" },
  succeeded: { label: "Succeeded", tone: "success", dot: "bg-emerald-300" },
  failed: { label: "Failed", tone: "danger", dot: "bg-red-300" },
  cancelled: { label: "Cancelled", tone: "muted", dot: "bg-white/30" },
}

/**
 * Human-in-the-loop approval gate for a run. This is a separate axis from
 * `status` (see migration 20261005000000_workflow_run_approval_state.sql): a hot
 * lead awaiting approval is `queued` with approvalState = "pending".
 */
export const APPROVAL_STATES = ["none", "pending", "approved", "rejected"] as const

export type ApprovalState = (typeof APPROVAL_STATES)[number]

export const APPROVAL_STATE_META: Record<ApprovalState, { label: string }> = {
  none: { label: "No approval required" },
  pending: { label: "Awaiting approval" },
  approved: { label: "Approved" },
  rejected: { label: "Rejected" },
}

export function normalizeApprovalState(value: unknown): ApprovalState {
  return typeof value === "string" &&
    (APPROVAL_STATES as readonly string[]).includes(value)
    ? (value as ApprovalState)
    : "none"
}

/** A run is resolvable only while it is queued and its gate is still pending. */
export function canResolveApproval(
  status: RunStatus,
  approvalState: ApprovalState,
): boolean {
  return status === "queued" && approvalState === "pending"
}

export type RunEventView = {
  eventType: string
  label: string
  description: string
  createdAt: string
}

const RUN_EVENT_LABELS: Record<string, { label: string; description?: string }> =
  {
    "run.queued": {
      label: "Queued",
      description: "The run was queued and is awaiting dispatch.",
    },
    "run.dispatching": {
      label: "Dispatching",
      description: "The run was sent to the execution adapter.",
    },
    "run.dispatched": {
      label: "Dispatched",
      description: "The execution adapter accepted the run.",
    },
    "run.dispatch_uncertain": {
      label: "Dispatch outcome uncertain",
      description: "The dispatch may not have reached the execution adapter; the run is being reconciled.",
    },
    "run.succeeded": {
      label: "Succeeded",
      description: "The execution completed successfully.",
    },
    "run.failed": {
      label: "Failed",
      description: "The execution did not complete successfully.",
    },
    "run.cancelled": {
      label: "Cancelled",
      description: "The execution was cancelled.",
    },
    "run.recovery_started": {
      label: "Recovery started",
      description: "An automated recovery attempt began.",
    },
    "run.recovery_deferred": {
      label: "Recovery deferred",
      description: "Final outcome is awaiting external reconciliation.",
    },
    "run.recovery_failed": {
      label: "Recovery failed",
      description: "An automated recovery attempt did not complete.",
    },
    "run.approval_required": {
      label: "Approval required",
      description: "The run is held until a human approves the next step.",
    },
    "run.approval_granted": {
      label: "Approval granted",
      description: "A human approver authorised the consequential step.",
    },
    "run.integration_delivered": {
      label: "Delivered",
      description: "The run was delivered to the external integration.",
    },
  }

export function mapRunEvent(eventType: string): { label: string; description: string } {
  const known = RUN_EVENT_LABELS[eventType]
  if (known) {
    return { label: known.label, description: known.description ?? "Execution event recorded." }
  }
  return {
    label: eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: "Execution event recorded.",
  }
}

export function humanizeRunId(runId: string): string {
  return `Run #${runId.slice(0, 8)}`
}

export function isTerminalStatus(status: RunStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled"
}

export function triggerTypeLabel(triggerType: string): string {
  switch (triggerType) {
    case "manual":
      return "Manual"
    case "schedule":
      return "Scheduled"
    case "webhook":
      return "Webhook"
    case "system":
      return "System"
    default:
      return triggerType
  }
}

export type RunDetailView = {
  id: string
  shortId: string
  workflowId: string
  workflowName: string
  projectId: string
  projectName: string
  clientId: string | null
  clientName: string | null
  status: RunStatus
  approvalState: ApprovalState
  triggerType: string
  requestedBy: string | null
  externalExecutionId: string | null
  errorCode: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export type RunSnapshot = {
  status: RunStatus
  externalExecutionId: string | null
  errorCode: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  events: RunEventView[]
}
