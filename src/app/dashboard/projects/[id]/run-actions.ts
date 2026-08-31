"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { dispatchWorkflowRun } from "@/lib/automation/execution-service"
import { logClientActivity } from "@/lib/client-activity"

async function getWorkspaceUser() {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const userId = claimsData?.claims?.sub

  if (claimsError || !userId) {
    throw new Error("Authentication required.")
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) {
    throw new Error("Workspace membership not found.")
  }

  return { supabase, userId, membership }
}

// Validates an optional client id against the actor's organization.
async function resolveClientId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  rawClientId: string,
): Promise<string | null> {
  const trimmed = rawClientId.trim()
  if (!trimmed) return null

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", trimmed)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!client) {
    throw new Error("Client not found in this workspace.")
  }

  return client.id
}

export async function updateWorkflowStatus(formData: FormData) {
  const workflowId = String(formData.get("workflowId") ?? "").trim()
  const status = String(formData.get("status") ?? "").trim()

  if (!workflowId || !["active", "paused"].includes(status)) {
    throw new Error("Invalid workflow status request.")
  }

  const { supabase, membership } = await getWorkspaceUser()

  if (!["owner", "admin", "member"].includes(membership.role)) {
    throw new Error("You do not have permission to change workflows.")
  }

  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .select("id, project_id, status")
    .eq("id", workflowId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()

  if (workflowError || !workflow) {
    throw new Error("Workflow not found in this workspace.")
  }

  const { error } = await supabase
    .from("workflows")
    .update({ status })
    .eq("id", workflow.id)
    .eq("organization_id", membership.organization_id)

  if (error) {
    throw new Error("Unable to update workflow status.")
  }

  revalidatePath(`/dashboard/projects/${workflow.project_id}`)
}

export async function queueWorkflowRun(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim()
  const workflowId = String(formData.get("workflowId") ?? "").trim()
  const rawClientId = String(formData.get("clientId") ?? "").trim()

  if (!projectId || !workflowId) {
    throw new Error("Project and workflow are required.")
  }

  return runQueueAndDispatch({ projectId, workflowId, rawClientId })
}

type QueueInput = {
  projectId: string
  workflowId: string
  rawClientId: string
}

// Shared queue-then-dispatch path used by both the project "Run now" action and
// the run detail "Run again" action. Creates a NEW durable run (never mutating
// an existing run record), records its queued event, then dispatches it.
async function runQueueAndDispatch({ projectId, workflowId, rawClientId }: QueueInput) {
  const { supabase, userId, membership } = await getWorkspaceUser()

  if (!["owner", "admin", "member"].includes(membership.role)) {
    throw new Error("You do not have permission to run workflows.")
  }

  const clientId = await resolveClientId(supabase, membership.organization_id, rawClientId)

  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .select("id, project_id, organization_id, status")
    .eq("id", workflowId)
    .eq("project_id", projectId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()

  if (workflowError || !workflow) {
    throw new Error("Workflow not found in this workspace.")
  }

  if (workflow.status !== "active") {
    throw new Error("Only active workflows can be queued.")
  }

  const { data: run, error: runError } = await supabase
    .from("workflow_runs")
    .insert({
      organization_id: membership.organization_id,
      workflow_id: workflow.id,
      project_id: workflow.project_id,
      client_id: clientId,
      status: "queued",
      trigger_type: "manual",
      requested_by: userId,
      idempotency_key: crypto.randomUUID(),
      input: {},
      last_activity_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (runError || !run) {
    throw new Error("Unable to queue workflow run.")
  }

  const { error: eventError } = await supabase
    .from("workflow_run_events")
    .insert({
      organization_id: membership.organization_id,
      run_id: run.id,
      event_type: "run.queued",
      message: "Workflow run queued manually.",
      payload: {
        trigger_type: "manual",
        client_id: clientId,
      },
    })

  if (eventError) {
    throw new Error(
      "Run was created but its audit event could not be recorded.",
    )
  }

  if (clientId) {
    await logClientActivity({
      organizationId: membership.organization_id,
      clientId,
      activityType: "workflow_run.associated",
      title: "Workflow run queued",
      description: "A manual workflow run was associated with this client.",
      actorUserId: userId,
      metadata: { run_id: run.id, workflow_id: workflow.id, project_id: projectId },
    })
  }

  try {
    await dispatchWorkflowRun(run.id, userId)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to dispatch workflow run."

    throw new Error(message)
  }

  revalidatePath(`/dashboard/projects/${projectId}`)

  return run.id
}

// Safe "Run again" flow. Loads the referenced run to confirm it belongs to the
// actor's workspace, then queues a brand-new run for the same workflow and
// client. The original run record is never mutated or re-executed.
export async function retryWorkflowRun(formData: FormData) {
  const runId = String(formData.get("runId") ?? "").trim()

  if (!runId) {
    throw new Error("Run reference is required.")
  }

  const { supabase, membership } = await getWorkspaceUser()

  if (!["owner", "admin", "member"].includes(membership.role)) {
    throw new Error("You do not have permission to run workflows.")
  }

  const { data: run, error: runError } = await supabase
    .from("workflow_runs")
    .select("id, workflow_id, project_id, client_id")
    .eq("id", runId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()

  if (runError || !run) {
    throw new Error("Run not found in this workspace.")
  }

  return runQueueAndDispatch({
    projectId: run.project_id,
    workflowId: run.workflow_id,
    rawClientId: run.client_id ?? "",
  })
}
