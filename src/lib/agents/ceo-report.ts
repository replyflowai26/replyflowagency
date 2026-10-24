// Jarvis CEO report — pure assembly and recommendation logic (task 62).
//
// The report exists so the CEO can read task progress, pending approvals,
// workflow outcomes, blockers and the next action without tailing logs. It is
// built ONLY from rows the server could actually read: an unavailable source is
// reported as "unknown" with a reason, never as zero, and no activity is ever
// invented. Cost is never estimated because no usage data exists.
//
// This module is dependency-free (type-only imports are erased) and performs no
// I/O, so it can be unit tested exhaustively without a database.

import type { ClientStatus } from "../../types/client"
import type { RunStatus } from "../dashboard/run-observability-core"
import {
  describeNotificationProviders,
  type NotificationProviderSummary,
} from "./notification-providers"

export const CEO_REPORT_WINDOW_DAYS = 7
export const CEO_REPORT_RECENT_RUN_LIMIT = 5
export const CEO_REPORT_PENDING_LIMIT = 20
export const CEO_REPORT_APPROVER_ROLE = "owner or admin"

export type DataSection<T> =
  | { status: "available"; data: T; note?: string }
  | { status: "unavailable"; reason: string }

export type CeoTaskCounts = {
  created: number
  queued: number
  running: number
  succeeded: number
  failed: number
  cancelled: number
  /** Queued tasks held at a human approval gate. */
  blockedOnApproval: number
}

export type CeoPendingApprovalInput = {
  id: string
  kind: "agent-task" | "workflow-run"
  title: string
  createdAt: string
}

export type CeoPendingApproval = CeoPendingApprovalInput & {
  /** Role responsible for resolving this gate. Policy is owner/admin. */
  approverRole: string
}

export type CeoRecentOutcome = {
  id: string
  workflowName: string
  status: RunStatus
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
}

export type CeoPipelineCounts = Readonly<Record<ClientStatus, number>>

export type CeoReportInput = {
  generatedAt: string
  tasks: DataSection<{ counts: CeoTaskCounts }>
  pendingApprovals: DataSection<{
    total: number
    items: readonly CeoPendingApprovalInput[]
  }>
  recentOutcomes: DataSection<{
    items: readonly CeoRecentOutcome[]
    failedInWindow: number
  }>
  pipeline: DataSection<{ counts: CeoPipelineCounts }>
}

export type CeoDataGap = {
  id: string
  label: string
  kind: "unavailable" | "not-configured"
  detail: string
}

export type CeoNextActionKind =
  | "restore-data"
  | "resolve-approvals"
  | "review-failures"
  | "create-task"
  | "run-task"
  | "idle"
  | "monitor"

export type CeoNextAction = {
  kind: CeoNextActionKind
  label: string
  detail: string
}

export type CeoReport = {
  generatedAt: string
  windowDays: number
  tasks: DataSection<{ counts: CeoTaskCounts }>
  pendingApprovals: DataSection<{
    total: number
    items: readonly CeoPendingApproval[]
  }>
  recentOutcomes: DataSection<{
    items: readonly CeoRecentOutcome[]
    failedInWindow: number
  }>
  pipeline: DataSection<{ counts: CeoPipelineCounts; total: number }>
  aiCosts: { status: "not-configured"; detail: string }
  notifications: readonly NotificationProviderSummary[]
  dataGaps: readonly CeoDataGap[]
  nextAction: CeoNextAction
}

function toCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm
}

const AI_COST_DETAIL =
  "No usage metering or provider billing data is recorded in this workspace, so AI/API cost is unknown."

/**
 * Assemble the CEO report. Every unavailable source is surfaced as a data gap;
 * the next action is derived deterministically, with human approvals first.
 */
export function buildCeoReport(input: CeoReportInput): CeoReport {
  const tasks: CeoReport["tasks"] =
    input.tasks.status === "available"
      ? {
          status: "available",
          data: {
            counts: {
              created: toCount(input.tasks.data.counts.created),
              queued: toCount(input.tasks.data.counts.queued),
              running: toCount(input.tasks.data.counts.running),
              succeeded: toCount(input.tasks.data.counts.succeeded),
              failed: toCount(input.tasks.data.counts.failed),
              cancelled: toCount(input.tasks.data.counts.cancelled),
              blockedOnApproval: toCount(input.tasks.data.counts.blockedOnApproval),
            },
          },
          ...(input.tasks.note ? { note: input.tasks.note } : {}),
        }
      : input.tasks

  const pendingApprovals: CeoReport["pendingApprovals"] =
    input.pendingApprovals.status === "available"
      ? {
          status: "available",
          data: {
            total: toCount(input.pendingApprovals.data.total),
            items: input.pendingApprovals.data.items.map((item) => ({
              ...item,
              approverRole: CEO_REPORT_APPROVER_ROLE,
            })),
          },
          ...(input.pendingApprovals.note ? { note: input.pendingApprovals.note } : {}),
        }
      : input.pendingApprovals

  const recentOutcomes: CeoReport["recentOutcomes"] =
    input.recentOutcomes.status === "available"
      ? {
          status: "available",
          data: {
            items: input.recentOutcomes.data.items,
            failedInWindow: toCount(input.recentOutcomes.data.failedInWindow),
          },
          ...(input.recentOutcomes.note ? { note: input.recentOutcomes.note } : {}),
        }
      : input.recentOutcomes

  const pipeline: CeoReport["pipeline"] =
    input.pipeline.status === "available"
      ? {
          status: "available",
          data: {
            counts: Object.fromEntries(
              Object.entries(input.pipeline.data.counts).map(([status, value]) => [
                status,
                toCount(value),
              ]),
            ) as CeoPipelineCounts,
            total: Object.values(input.pipeline.data.counts).reduce(
              (sum, value) => sum + toCount(value),
              0,
            ),
          },
          ...(input.pipeline.note ? { note: input.pipeline.note } : {}),
        }
      : input.pipeline

  const dataGaps: CeoDataGap[] = []
  if (tasks.status === "unavailable") {
    dataGaps.push({ id: "tasks", label: "Jarvis task progress", kind: "unavailable", detail: tasks.reason })
  }
  if (pendingApprovals.status === "unavailable") {
    dataGaps.push({
      id: "approvals",
      label: "Pending approvals",
      kind: "unavailable",
      detail: pendingApprovals.reason,
    })
  }
  if (recentOutcomes.status === "unavailable") {
    dataGaps.push({
      id: "runs",
      label: "Workflow outcomes",
      kind: "unavailable",
      detail: recentOutcomes.reason,
    })
  }
  if (pipeline.status === "unavailable") {
    dataGaps.push({
      id: "pipeline",
      label: "Client pipeline",
      kind: "unavailable",
      detail: pipeline.reason,
    })
  }
  dataGaps.push({ id: "ai-costs", label: "AI/API cost", kind: "not-configured", detail: AI_COST_DETAIL })
  dataGaps.push({
    id: "notifications",
    label: "Email / WhatsApp / phone delivery",
    kind: "not-configured",
    detail: "No notification provider is built or configured; nothing can be sent from this report.",
  })

  const nextAction = deriveNextAction({ tasks, pendingApprovals, recentOutcomes })

  return {
    generatedAt: input.generatedAt,
    windowDays: CEO_REPORT_WINDOW_DAYS,
    tasks,
    pendingApprovals,
    recentOutcomes,
    pipeline,
    aiCosts: { status: "not-configured", detail: AI_COST_DETAIL },
    notifications: describeNotificationProviders(),
    dataGaps,
    nextAction,
  }
}

function deriveNextAction(input: {
  tasks: CeoReport["tasks"]
  pendingApprovals: CeoReport["pendingApprovals"]
  recentOutcomes: CeoReport["recentOutcomes"]
}): CeoNextAction {
  const { tasks, pendingApprovals, recentOutcomes } = input

  const coreUnavailable =
    tasks.status === "unavailable" &&
    pendingApprovals.status === "unavailable" &&
    recentOutcomes.status === "unavailable"
  if (coreUnavailable) {
    return {
      kind: "restore-data",
      label: "Restore data access before trusting this report",
      detail:
        "Task, approval and workflow data are all unavailable in this environment. " +
        "Check the runtime tables and the approval-state column before acting on any count.",
    }
  }

  if (pendingApprovals.status === "available" && pendingApprovals.data.total > 0) {
    const total = pendingApprovals.data.total
    return {
      kind: "resolve-approvals",
      label: `Resolve ${total} pending ${plural(total, "approval")}`,
      detail: `Only ${CEO_REPORT_APPROVER_ROLE}s can approve or reject. Nothing consequential runs until they do.`,
    }
  }

  if (recentOutcomes.status === "available" && recentOutcomes.data.failedInWindow > 0) {
    const failed = recentOutcomes.data.failedInWindow
    return {
      kind: "review-failures",
      label: `Review ${failed} failed ${plural(failed, "run")} in the last ${CEO_REPORT_WINDOW_DAYS} days`,
      detail:
        "Open the run timeline for the recorded error code and last event. Failures are never retried blindly.",
    }
  }

  if (tasks.status === "available" && tasks.data.counts.created === 0) {
    return {
      kind: "create-task",
      label: "Create the first Jarvis task",
      detail: "No agent tasks are recorded in this workspace yet.",
    }
  }

  if (tasks.status === "available" && tasks.data.counts.queued > 0) {
    const queued = tasks.data.counts.queued
    return {
      kind: "run-task",
      label: `Run or approve ${queued} queued ${plural(queued, "task")}`,
      detail: "Queued tasks wait for an explicit human action; nothing runs on its own.",
    }
  }

  if (recentOutcomes.status === "available" && recentOutcomes.data.items.length === 0) {
    return {
      kind: "idle",
      label: `No recorded activity in the last ${CEO_REPORT_WINDOW_DAYS} days`,
      detail: "Create a task or run a workflow to produce reportable activity.",
    }
  }

  return {
    kind: "monitor",
    label: "No action required right now",
    detail: `No pending approvals or failed runs were recorded in the last ${CEO_REPORT_WINDOW_DAYS} days.`,
  }
}
