import "server-only"

import { createClient } from "@/lib/supabase/server"
import { triggerN8nExecution } from "@/lib/automation/n8n"

export async function dispatchWorkflowRun(runId: string, userId: string) {
  const supabase = await createClient()

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) throw new Error("Workspace membership not found.")
  if (!["owner", "admin", "member"].includes(membership.role)) throw new Error("Insufficient permissions.")

  const { data: run, error: runError } = await supabase
    .from("workflow_runs")
    .select("id, organization_id, workflow_id, project_id, status, input")
    .eq("id", runId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()

  if (runError || !run) throw new Error("Workflow run not found.")
  if (run.status !== "queued") throw new Error("Only queued runs can be dispatched.")

  const startedAt = new Date().toISOString()
  const { error: runningError } = await supabase
    .from("workflow_runs")
    .update({ status: "running", started_at: startedAt, error_code: null, error_message: null })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id)
    .eq("status", "queued")

  if (runningError) throw new Error("Unable to start workflow run.")

  await supabase.from("workflow_run_events").insert({
    organization_id: run.organization_id,
    run_id: run.id,
    event_type: "run.dispatching",
    message: "Workflow run dispatched to execution adapter.",
    payload: { adapter: "n8n" },
  })

  try {
    const result = await triggerN8nExecution({
      workflowId: run.workflow_id,
      runId: run.id,
      organizationId: run.organization_id,
      input: (run.input ?? {}) as Record<string, unknown>,
    })

    const { error: updateError } = await supabase
      .from("workflow_runs")
      .update({ external_execution_id: result.externalExecutionId })
      .eq("id", run.id)
      .eq("organization_id", run.organization_id)
      .eq("status", "running")

    if (updateError) throw new Error("Unable to persist external execution id.")

    await supabase.from("workflow_run_events").insert({
      organization_id: run.organization_id,
      run_id: run.id,
      event_type: "run.dispatched",
      message: "n8n accepted the workflow execution request.",
      payload: {
        external_execution_id: result.externalExecutionId,
        dispatch_attempts: result.attempts,
      },
    })

    return { runId: run.id, externalExecutionId: result.externalExecutionId }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution adapter error."
    await supabase
      .from("workflow_runs")
      .update({ status: "failed", completed_at: new Date().toISOString(), error_code: "EXECUTION_ADAPTER_ERROR", error_message: message })
      .eq("id", run.id)
      .eq("organization_id", run.organization_id)
      .eq("status", "running")

    await supabase.from("workflow_run_events").insert({
      organization_id: run.organization_id,
      run_id: run.id,
      event_type: "run.failed",
      message: "Workflow execution adapter failed.",
      payload: { error_code: "EXECUTION_ADAPTER_ERROR" },
    })

    throw new Error(message)
  }
}
