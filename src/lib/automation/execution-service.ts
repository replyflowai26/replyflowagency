import "server-only"

import { createClient } from "@/lib/supabase/server"
import { isWorkflowRunStatus } from "@/lib/automation/run-state-machine"
import { dispatchToN8nWebhook } from "@/lib/automation/n8n"

type WorkflowRunRow = {
  id: string
  organization_id: string
  workflow_id: string
  status: string
  input: Record<string, unknown> | null
}

type DispatchResult = {
  runId: string
  // True when n8n accepted the dispatch. Terminal outcomes still come from the
  // callback. `uncertain` is true when the dispatch may or may not have reached
  // n8n (network ambiguity); the run is left `running` so the recovery/callback
  // path can reconcile without risking duplicate external side effects.
  uncertain: boolean
  message: string | null
}

async function recordEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  runId: string,
  eventType: string,
  message: string,
  payload: Record<string, unknown> = {},
) {
  return supabase.from("workflow_run_events").insert({
    organization_id: organizationId,
    run_id: runId,
    event_type: eventType,
    message,
    payload,
  })
}

export async function dispatchWorkflowRun(
  runId: string,
  userId: string,
): Promise<DispatchResult> {
  const supabase = await createClient()

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

  if (!["owner", "admin", "member"].includes(membership.role)) {
    throw new Error("Insufficient permissions.")
  }

  const { data: run, error: runError } = await supabase
    .from("workflow_runs")
    .select(
      "id, organization_id, workflow_id, project_id, status, input, workflows!workflow_runs_workflow_id_organization_id_fkey(n8n_webhook_path, n8n_workflow_id)",
    )
    .eq("id", runId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()

  if (runError) {
    throw new Error("Unable to load workflow run.")
  }
  if (!run) {
    throw new Error("Workflow run not found.")
  }

  if (!isWorkflowRunStatus(run.status) || run.status !== "queued") {
    throw new Error("Only queued runs can be dispatched.")
  }

  const workflowRow = Array.isArray(run.workflows) ? run.workflows[0] : run.workflows
  const webhookPath =
    typeof workflowRow?.n8n_webhook_path === "string"
      ? workflowRow.n8n_webhook_path
      : null
  const n8nWorkflowId =
    typeof workflowRow?.n8n_workflow_id === "string" ? workflowRow.n8n_workflow_id : null

  // A run with no mapped n8n webhook cannot be dispatched. Fail it while it is
  // still `queued` (no external side effect was ever started) so it never
  // becomes a permanently-stuck run.
  if (!webhookPath) {
    await failRun(supabase, run, "DISPATCH_CONFIG_ERROR", "Workflow is not mapped to an n8n webhook.")
    await recordEvent(
      supabase,
      run.organization_id,
      run.id,
      "run.failed",
      "Workflow is not mapped to an n8n webhook.",
      { error_code: "DISPATCH_CONFIG_ERROR" },
    )
    throw new Error("Workflow is not mapped to an n8n webhook.")
  }

  // Guarded compare-and-set: only one actor may move a run from queued to
  // running. This is the core dispatch idempotency guarantee against a retry
  // or a concurrent caller dispatching the same run twice.
  const startedAt = new Date().toISOString()
  const { data: claimed, error: runningError } = await supabase
    .from("workflow_runs")
    .update({
      status: "running",
      started_at: startedAt,
      last_activity_at: startedAt,
      error_code: null,
      error_message: null,
    })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle()

  if (runningError) {
    throw new Error("Unable to start workflow run.")
  }
  if (!claimed) {
    // Another actor dispatched this run first. Never dispatch twice.
    throw new Error("Workflow run was already dispatched.")
  }

  await recordEvent(
    supabase,
    run.organization_id,
    run.id,
    "run.dispatching",
    "Workflow run queued for external dispatch.",
    { adapter: "n8n-webhook" },
  )

  const dispatch = await dispatchToN8nWebhook({
    workflowId: run.workflow_id,
    runId: run.id,
    organizationId: run.organization_id,
    webhookPath,
    input: (run.input ?? {}) as Record<string, unknown>,
  })

  const activityAt = new Date().toISOString()

  if (dispatch.ok) {
    // n8n accepted the webhook. Dispatch success does NOT mean workflow
    // success: the run stays `running` until the callback resolves it.
    await supabase
      .from("workflow_runs")
      .update({ last_activity_at: activityAt })
      .eq("id", run.id)
      .eq("organization_id", run.organization_id)

    await recordEvent(
      supabase,
      run.organization_id,
      run.id,
      "run.dispatched",
      "n8n accepted the workflow, awaiting callback.",
    )

    return { runId: run.id, uncertain: false, message: null }
  }

  if (dispatch.reason === "network") {
    // A network timeout does not prove n8n never started. Never mark this
    // failed and never re-dispatch blindly: the run stays `running` and the
    // recovery/callback layer reconciles the true outcome.
    await supabase
      .from("workflow_runs")
      .update({ last_activity_at: activityAt })
      .eq("id", run.id)
      .eq("organization_id", run.organization_id)

    await recordEvent(
      supabase,
      run.organization_id,
      run.id,
      "run.dispatch_uncertain",
      "Dispatch outcome is uncertain (network ambiguity); awaiting callback.",
      { reason: "network" },
    )

    return {
      runId: run.id,
      uncertain: true,
      message: "Dispatch outcome is uncertain; the run will be reconciled.",
    }
  }

  // Deterministic dispatch rejection (n8n returned an HTTP error, or the
  // integration is invalid). n8n did not start, so failing the run is safe.
  let errorCode: string
  let errorMessage: string
  if (dispatch.reason === "http_error") {
    errorCode = "N8N_DISPATCH_REJECTED"
    errorMessage = `n8n rejected the dispatch (HTTP ${dispatch.status ?? "error"}).`
  } else if (dispatch.reason === "not_registered") {
    // n8n answered an intentional 404 stating the mapped webhook is not
    // registered. This is a configuration problem (workflow inactive, still in
    // test mode, or path mismatch), not a transient n8n failure. Classify it
    // explicitly so operators get an actionable signal instead of a generic
    // HTTP rejection.
    errorCode = "DISPATCH_CONFIG_ERROR"
    errorMessage = n8nWorkflowId
      ? `n8n returned HTTP 404: webhook "${webhookPath}" (workflow id ${n8nWorkflowId}) is not registered. Activate the workflow in n8n or remap the correct webhook path.`
      : `n8n returned HTTP 404: webhook "${webhookPath}" is not registered. Activate the workflow in n8n or remap the correct webhook path.`
  } else {
    errorCode = "DISPATCH_CONFIG_ERROR"
    errorMessage = "n8n integration is not configured."
  }

  await supabase
    .from("workflow_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      error_code: errorCode,
      error_message: errorMessage,
    })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id)

  await recordEvent(supabase, run.organization_id, run.id, "run.failed", errorMessage, {
    error_code: errorCode,
    http_status: dispatch.status ?? undefined,
  })

  throw new Error(errorMessage)
}

async function failRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  run: { id: string; organization_id: string },
  errorCode: string,
  errorMessage: string,
) {
  await supabase
    .from("workflow_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      error_code: errorCode,
      error_message: errorMessage,
    })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id)
}
