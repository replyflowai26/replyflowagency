import "server-only"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/telemetry/logging"
import {
  mapRunEvent,
  humanizeRunId,
  normalizeApprovalState,
  type RunDetailView,
  type RunEventView,
} from "./run-observability-core"

export * from "./run-observability-core"

type RunRow = {
  id: string
  workflow_id: string
  project_id: string
  client_id: string | null
  status: string
  approval_state?: string | null
  trigger_type: string
  requested_by: string | null
  external_execution_id: string | null
  error_code: string | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  workflows: { id: string; name: string } | { id: string; name: string }[] | null
  automation_projects: { id: string; name: string } | { id: string; name: string }[] | null
}

// Columns selected for the run detail read. `approval_state` is added by the
// approval migration (20261005000000). It is read through an explicit
// two-attempt path below so an environment where that migration has not yet been
// applied keeps rendering the run page instead of failing the whole query.
const RUN_BASE_COLUMNS =
  "id, workflow_id, project_id, client_id, status, trigger_type, requested_by, external_execution_id, error_code, error_message, started_at, completed_at, created_at, updated_at"

const RUN_EMBEDS =
  "workflows!workflow_runs_workflow_id_organization_id_fkey(id, name), automation_projects!workflow_runs_project_id_organization_id_fkey(id, name)"

function isMissingApprovalColumn(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false
  const code = typeof error.code === "string" ? error.code : ""
  const message = typeof error.message === "string" ? error.message : ""
  return code === "42703" || message.includes("approval_state")
}

async function loadRunRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  runId: string,
) {
  const runQuery = (columns: string) =>
    supabase
      .from("workflow_runs")
      .select(columns)
      .eq("id", runId)
      .eq("organization_id", organizationId)
      .maybeSingle()

  let { data: raw, error: runError } = await runQuery(
    `${RUN_BASE_COLUMNS}, approval_state, ${RUN_EMBEDS}`,
  )

  if (runError && isMissingApprovalColumn(runError)) {
    // The approval migration is not applied in this environment. Fall back to
    // the pre-approval read so the run page keeps working (approval state
    // defaults to "none").
    const fallback = await runQuery(`${RUN_BASE_COLUMNS}, ${RUN_EMBEDS}`)
    raw = fallback.data
    runError = fallback.error
  }

  if (runError) {
    logError("run.detail", "Unable to load workflow run", runError, {
      organization_id: organizationId,
      run_id: runId,
    })
    throw new Error("Unable to load workflow run.")
  }
  if (!raw) {
    return null
  }

  const run = raw as unknown as RunRow
  const workflow = Array.isArray(run.workflows) ? run.workflows[0] : run.workflows
  const project = Array.isArray(run.automation_projects) ? run.automation_projects[0] : run.automation_projects

  let client: { id: string; name: string } | null = null
  if (run.client_id) {
    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", run.client_id)
      .eq("organization_id", organizationId)
      .maybeSingle()
    if (clientError) {
      logError("run.client", "Unable to load linked client", clientError, {
        organization_id: organizationId,
        run_id: runId,
        client_id: run.client_id,
      })
    } else {
      client = clientRow ?? null
    }
  }

  return { run, workflow, project, client }
}

export async function getRunDetail(
  organizationId: string,
  runId: string,
): Promise<RunDetailView | null> {
  const supabase = await createClient()
  const loaded = await loadRunRow(supabase, organizationId, runId)
  if (!loaded) return null

  const { run, workflow, project, client } = loaded

  return {
    id: run.id,
    shortId: humanizeRunId(run.id),
    workflowId: run.workflow_id,
    workflowName: workflow?.name ?? "Unknown workflow",
    projectId: run.project_id,
    projectName: project?.name ?? "Unknown project",
    clientId: client?.id ?? null,
    clientName: client?.name ?? null,
    status: run.status as RunDetailView["status"],
    approvalState: normalizeApprovalState(run.approval_state),
    triggerType: run.trigger_type,
    requestedBy: run.requested_by,
    externalExecutionId: run.external_execution_id,
    errorCode: run.error_code,
    errorMessage: run.error_message,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }
}

export async function getRunEvents(
  organizationId: string,
  runId: string,
  limit = 50,
): Promise<RunEventView[]> {
  const supabase = await createClient()
  const { data: events, error } = await supabase
    .from("workflow_run_events")
    .select("event_type, message, created_at")
    .eq("run_id", runId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) {
    logError("run.events", "Unable to load execution timeline", error, {
      organization_id: organizationId,
      run_id: runId,
    })
    throw new Error("Unable to load execution timeline.")
  }

  return (events ?? []).map((event) => {
    const mapped = mapRunEvent(event.event_type)
    return {
      eventType: event.event_type,
      label: mapped.label,
      description: event.message ? String(event.message) : mapped.description,
      createdAt: event.created_at,
    }
  })
}

export async function getRunSnapshot(
  organizationId: string,
  runId: string,
  eventLimit = 50,
): Promise<{ detail: RunDetailView | null; events: RunEventView[] }> {
  const detail = await getRunDetail(organizationId, runId)
  if (!detail) {
    return { detail: null, events: [] }
  }
  const events = await getRunEvents(organizationId, runId, eventLimit)
  return { detail, events }
}
