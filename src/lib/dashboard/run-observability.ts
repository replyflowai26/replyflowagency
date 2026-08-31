import "server-only"

import { createClient } from "@/lib/supabase/server"
import {
  mapRunEvent,
  humanizeRunId,
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
  clients: { id: string; name: string } | { id: string; name: string }[] | null
}

async function loadRunRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  runId: string,
) {
  const { data: raw, error: runError } = await supabase
    .from("workflow_runs")
    .select("id, workflow_id, project_id, client_id, status, trigger_type, requested_by, external_execution_id, error_code, error_message, started_at, completed_at, created_at, updated_at, workflows(id, name), automation_projects(id, name), clients(id, name)")
    .eq("id", runId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (runError) {
    throw new Error("Unable to load workflow run.")
  }
  if (!raw) {
    return null
  }

  const run = raw as unknown as RunRow
  const workflow = Array.isArray(run.workflows) ? run.workflows[0] : run.workflows
  const project = Array.isArray(run.automation_projects) ? run.automation_projects[0] : run.automation_projects
  const client = Array.isArray(run.clients) ? run.clients[0] : run.clients

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
