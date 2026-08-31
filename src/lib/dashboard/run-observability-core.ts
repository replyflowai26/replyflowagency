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
