import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

type CallbackStatus = "succeeded" | "failed" | "cancelled"

type CallbackPayload = {
  runId?: string
  externalExecutionId?: string
  status?: CallbackStatus
  output?: Record<string, unknown>
  errorCode?: string
  errorMessage?: string
}

const TERMINAL_STATUSES = new Set<CallbackStatus>(["succeeded", "failed", "cancelled"])

function isValidRunId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function secretsMatch(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer)
}

export async function POST(request: Request) {
  const expectedSecret = process.env.N8N_CALLBACK_SECRET
  if (!expectedSecret) {
    return NextResponse.json({ error: "Callback integration is not configured." }, { status: 503 })
  }

  const providedSecret = request.headers.get("x-n8n-callback-secret")
  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized callback." }, { status: 401 })
  }

  let payload: CallbackPayload
  try {
    payload = (await request.json()) as CallbackPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  if (!isValidRunId(payload.runId)) {
    return NextResponse.json({ error: "A valid runId is required." }, { status: 400 })
  }

  if (!payload.status || !TERMINAL_STATUSES.has(payload.status)) {
    return NextResponse.json({ error: "A terminal execution status is required." }, { status: 400 })
  }

  if (payload.output !== undefined && (typeof payload.output !== "object" || payload.output === null || Array.isArray(payload.output))) {
    return NextResponse.json({ error: "output must be a JSON object." }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: run, error: runError } = await supabase
    .from("workflow_runs")
    .select("id, organization_id, status, external_execution_id")
    .eq("id", payload.runId)
    .maybeSingle()

  if (runError) {
    console.error("n8n callback lookup failed", runError)
    return NextResponse.json({ error: "Unable to load workflow run." }, { status: 500 })
  }

  if (!run) return NextResponse.json({ error: "Workflow run not found." }, { status: 404 })

  if (payload.externalExecutionId && run.external_execution_id && payload.externalExecutionId !== run.external_execution_id) {
    return NextResponse.json({ error: "External execution id does not match the workflow run." }, { status: 409 })
  }

  if (run.status === payload.status) {
    return NextResponse.json({ runId: run.id, status: run.status, duplicate: true })
  }

  if (run.status !== "running") {
    return NextResponse.json({ error: `Run is not awaiting a terminal callback (status: ${run.status}).` }, { status: 409 })
  }

  const completedAt = new Date().toISOString()
  const update = {
    status: payload.status,
    output: payload.output ?? null,
    error_code: payload.status === "failed" ? payload.errorCode ?? "N8N_EXECUTION_FAILED" : null,
    error_message: payload.status === "failed" ? payload.errorMessage ?? "n8n execution failed." : null,
    completed_at: completedAt,
    execution_timeout_at: null,
  }

  const { error: updateError } = await supabase
    .from("workflow_runs")
    .update(update)
    .eq("id", run.id)
    .eq("organization_id", run.organization_id)
    .eq("status", "running")

  if (updateError) {
    console.error("n8n callback update failed", updateError)
    return NextResponse.json({ error: "Unable to finalize workflow run." }, { status: 500 })
  }

  const { error: eventError } = await supabase.from("workflow_run_events").insert({
    organization_id: run.organization_id,
    run_id: run.id,
    event_type: `run.${payload.status}`,
    message: `n8n reported workflow execution as ${payload.status}.`,
    payload: {
      external_execution_id: payload.externalExecutionId ?? run.external_execution_id,
      error_code: update.error_code,
    },
  })

  if (eventError) {
    console.error("n8n callback event write failed", eventError)
  }

  return NextResponse.json({ runId: run.id, status: payload.status, duplicate: false })
}
