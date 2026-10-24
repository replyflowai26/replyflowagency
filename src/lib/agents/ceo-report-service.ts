import "server-only"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/telemetry/logging"
import {
  buildCeoReport,
  CEO_REPORT_PENDING_LIMIT,
  CEO_REPORT_RECENT_RUN_LIMIT,
  CEO_REPORT_WINDOW_DAYS,
  type CeoPendingApprovalInput,
  type CeoRecentOutcome,
  type CeoReport,
  type CeoReportInput,
} from "./ceo-report"
import { isPersistenceUnavailableError } from "./task-center"
import type { ClientStatus } from "@/types/client"
import type { RunStatus } from "@/lib/dashboard/run-observability-core"

// Read-only assembly of the Jarvis CEO report (task 62).
//
// Authorization/tenant boundary: every query filters on the organization id
// resolved server-side from the authenticated user's membership (the page
// never accepts an organization id from the browser) and runs through the
// user-scoped Supabase client, so RLS applies in addition to the filter.
//
// Each section is independently bounded and independently honest: a source
// that cannot be read is reported as unavailable with a reason. It is never
// substituted with invented activity or a misleading zero.

const TASK_TABLE = "ai_agent_tasks"
const RUN_TABLE = "workflow_runs"
const TASK_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const
const CLIENT_STATUSES: readonly ClientStatus[] = [
  "lead",
  "prospect",
  "active",
  "paused",
  "completed",
  "archived",
]
const RUN_EMBED = "workflows!workflow_runs_workflow_id_organization_id_fkey(name)"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type RunRow = {
  id: string
  status: string
  error_code: string | null
  error_message: string | null
  created_at: string
  workflows: { name: string } | { name: string }[] | null
}

function unavailable(reason: string): { status: "unavailable"; reason: string } {
  return { status: "unavailable", reason }
}

function isMissingRelationError(error: unknown): boolean {
  return isPersistenceUnavailableError(error)
}

function isMissingApprovalColumnError(error: unknown): boolean {
  const record = error as { code?: unknown; message?: unknown } | null | undefined
  if (record?.code === "42703") return true
  return typeof record?.message === "string" && record.message.includes("approval_state")
}

function workflowName(row: RunRow): string {
  const workflow = Array.isArray(row.workflows) ? row.workflows[0] : row.workflows
  return workflow?.name ?? "Unknown workflow"
}

async function loadTaskSection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CeoReportInput["tasks"]> {
  const base = () =>
    supabase
      .from(TASK_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)

  const results = await Promise.all([
    base(),
    ...TASK_STATUSES.map((status) => base().eq("status", status)),
    base().eq("status", "queued").eq("approval_state", "pending"),
  ])

  if (results.some((result) => isMissingRelationError(result.error))) {
    return unavailable(
      "Agent task tables are not provisioned in this environment (runtime migration not applied; B1 → B2).",
    )
  }
  const failedRead = results.find((result) => result.error)
  if (failedRead?.error) {
    logError("ceo-report.tasks", "Unable to read agent task counts", failedRead.error, {
      organization_id: organizationId,
    })
    return unavailable("Jarvis task counts could not be read in this environment.")
  }

  const [total, queued, running, succeeded, failed, cancelled, blocked] = results.map(
    (result) => result.count ?? 0,
  )

  return {
    status: "available",
    data: {
      counts: {
        created: total,
        queued,
        running,
        succeeded,
        failed,
        cancelled,
        blockedOnApproval: blocked,
      },
    },
  }
}

async function loadPendingApprovals(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CeoReportInput["pendingApprovals"]> {
  const items: CeoPendingApprovalInput[] = []
  const notes: string[] = []

  let agentTotal = 0
  let agentUnavailable = false
  const agentCountQuery = await supabase
    .from(TASK_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("approval_state", "pending")
  const agentListQuery = await supabase
    .from(TASK_TABLE)
    .select("id, title, created_at")
    .eq("organization_id", organizationId)
    .eq("approval_state", "pending")
    .order("created_at", { ascending: true })
    .limit(CEO_REPORT_PENDING_LIMIT)

  if (isMissingRelationError(agentCountQuery.error) || isMissingRelationError(agentListQuery.error)) {
    agentUnavailable = true
    notes.push("Jarvis task approvals are unavailable (runtime migration not applied; B1 → B2).")
  } else if (agentCountQuery.error || agentListQuery.error) {
    agentUnavailable = true
    logError(
      "ceo-report.approvals",
      "Unable to read pending agent approvals",
      agentCountQuery.error ?? agentListQuery.error,
      { organization_id: organizationId },
    )
    notes.push("Jarvis task approvals could not be read in this environment.")
  } else {
    agentTotal = agentCountQuery.count ?? 0
    for (const row of agentListQuery.data ?? []) {
      items.push({
        id: String(row.id),
        kind: "agent-task",
        title: String(row.title ?? "Untitled task"),
        createdAt: String(row.created_at ?? ""),
      })
    }
  }

  let runTotal = 0
  let runUnavailable = false
  const runCountQuery = await supabase
    .from(RUN_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "queued")
    .eq("approval_state", "pending")
  const runListQuery = await supabase
    .from(RUN_TABLE)
    .select(`id, created_at, ${RUN_EMBED}`)
    .eq("organization_id", organizationId)
    .eq("status", "queued")
    .eq("approval_state", "pending")
    .order("created_at", { ascending: true })
    .limit(CEO_REPORT_PENDING_LIMIT)

  if (
    isMissingApprovalColumnError(runCountQuery.error) ||
    isMissingApprovalColumnError(runListQuery.error)
  ) {
    runUnavailable = true
    notes.push(
      "Workflow-run approvals are unavailable because the approval-state column is not applied (B1 → B2).",
    )
  } else if (runCountQuery.error || runListQuery.error) {
    runUnavailable = true
    logError(
      "ceo-report.approvals",
      "Unable to read pending workflow-run approvals",
      runCountQuery.error ?? runListQuery.error,
      { organization_id: organizationId },
    )
    notes.push("Workflow-run approvals could not be read in this environment.")
  } else {
    runTotal = runCountQuery.count ?? 0
    for (const row of (runListQuery.data ?? []) as unknown as RunRow[]) {
      items.push({
        id: row.id,
        kind: "workflow-run",
        title: `${workflowName(row)} — lead approval`,
        createdAt: String(row.created_at ?? ""),
      })
    }
  }

  if (agentUnavailable && runUnavailable) {
    return unavailable("Pending approvals could not be read from either approval surface.")
  }

  items.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

  return {
    status: "available",
    data: {
      total: agentTotal + runTotal,
      items: items.slice(0, CEO_REPORT_PENDING_LIMIT),
    },
    ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
  }
}

async function loadRecentOutcomes(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CeoReportInput["recentOutcomes"]> {
  const since = new Date(
    Date.now() - CEO_REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const [recentQuery, failedQuery] = await Promise.all([
    supabase
      .from(RUN_TABLE)
      .select(`id, status, error_code, error_message, created_at, ${RUN_EMBED}`)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(CEO_REPORT_RECENT_RUN_LIMIT),
    supabase
      .from(RUN_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "failed")
      .gte("created_at", since),
  ])

  if (recentQuery.error || failedQuery.error) {
    logError(
      "ceo-report.outcomes",
      "Unable to read recent workflow outcomes",
      recentQuery.error ?? failedQuery.error,
      { organization_id: organizationId },
    )
    return unavailable("Workflow outcomes could not be read in this environment.")
  }

  const items: CeoRecentOutcome[] = ((recentQuery.data ?? []) as unknown as RunRow[]).map(
    (row) => ({
      id: row.id,
      workflowName: workflowName(row),
      status: row.status as RunStatus,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: String(row.created_at ?? ""),
    }),
  )

  return {
    status: "available",
    data: { items, failedInWindow: failedQuery.count ?? 0 },
  }
}

async function loadPipelineSection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CeoReportInput["pipeline"]> {
  const results = await Promise.all(
    CLIENT_STATUSES.map((status) =>
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", status),
    ),
  )

  const failedRead = results.find((result) => result.error)
  if (failedRead?.error) {
    logError("ceo-report.pipeline", "Unable to read client pipeline counts", failedRead.error, {
      organization_id: organizationId,
    })
    return unavailable("Client pipeline counts could not be read in this environment.")
  }

  const counts = Object.fromEntries(
    CLIENT_STATUSES.map((status, index) => [status, results[index].count ?? 0]),
  ) as Record<ClientStatus, number>

  return { status: "available", data: { counts } }
}

/**
 * Build the CEO report for one organization. Never throws for a missing
 * source: the affected section is marked unavailable with a reason.
 */
export async function getCeoReport(organizationId: string): Promise<CeoReport> {
  const supabase = await createClient()

  const [tasks, pendingApprovals, recentOutcomes, pipeline] = await Promise.all([
    loadTaskSection(supabase, organizationId),
    loadPendingApprovals(supabase, organizationId),
    loadRecentOutcomes(supabase, organizationId),
    loadPipelineSection(supabase, organizationId),
  ])

  return buildCeoReport({
    generatedAt: new Date().toISOString(),
    tasks,
    pendingApprovals,
    recentOutcomes,
    pipeline,
  })
}
