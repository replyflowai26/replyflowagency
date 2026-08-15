"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

async function getWorkspaceUser() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) throw new Error("Authentication required.")

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (membershipError || !membership) throw new Error("Workspace membership not found.")

  return { supabase, userId, membership }
}

export async function updateWorkflowStatus(formData: FormData) {
  const workflowId = String(formData.get("workflowId") ?? "").trim()
  const status = String(formData.get("status") ?? "").trim()
  if (!workflowId || !["active", "paused"].includes(status)) throw new Error("Invalid workflow status request.")

  const { supabase, membership } = await getWorkspaceUser()
  if (!["owner", "admin", "member"].includes(membership.role)) throw new Error("You do not have permission to change workflows.")

  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .select("id, project_id, status")
    .eq("id", workflowId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()
  if (workflowError || !workflow) throw new Error("Workflow not found in this workspace.")

  const { error } = await supabase
    .from("workflows")
    .update({ status })
    .eq("id", workflow.id)
    .eq("organization_id", membership.organization_id)
  if (error) throw new Error("Unable to update workflow status.")

  revalidatePath(`/dashboard/projects/${workflow.project_id}`)
}

export async function queueWorkflowRun(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim()
  const workflowId = String(formData.get("workflowId") ?? "").trim()
  if (!projectId || !workflowId) throw new Error("Project and workflow are required.")

  const { supabase, userId, membership } = await getWorkspaceUser()
  if (!["owner", "admin", "member"].includes(membership.role)) throw new Error("You do not have permission to run workflows.")

  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .select("id, project_id, organization_id, status")
    .eq("id", workflowId)
    .eq("project_id", projectId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()
  if (workflowError || !workflow) throw new Error("Workflow not found in this workspace.")
  if (workflow.status !== "active") throw new Error("Only active workflows can be queued.")

  const { data: run, error: runError } = await supabase
    .from("workflow_runs")
    .insert({
      organization_id: membership.organization_id,
      workflow_id: workflow.id,
      project_id: workflow.project_id,
      status: "queued",
      trigger_type: "manual",
      requested_by: userId,
      idempotency_key: crypto.randomUUID(),
      input: {},
    })
    .select("id")
    .single()
  if (runError || !run) throw new Error("Unable to queue workflow run.")

  const { error: eventError } = await supabase.from("workflow_run_events").insert({
    organization_id: membership.organization_id,
    run_id: run.id,
    event_type: "run.queued",
    message: "Workflow run queued manually.",
    payload: { trigger_type: "manual" },
  })
  if (eventError) throw new Error("Run was created but its audit event could not be recorded.")

  revalidatePath(`/dashboard/projects/${projectId}`)
  return run.id
}
