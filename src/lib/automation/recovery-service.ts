import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { logError } from "@/lib/telemetry/logging"
import {
  canTransitionRun,
  isWorkflowRunStatus,
  type WorkflowRunStatus,
} from "@/lib/automation/run-state-machine"
import { getN8nExecutionStatus } from "@/lib/automation/n8n-status"

//
// Recovery policy
// ===============
// Recovery never blindly retries external automation. Retrying a run whose n8n
// execution may actually have started would create duplicate external side
// effects. Instead each stale run is classified:
//
//   - "queued" stale beyond DISPATCH_TIMEOUT_MS  → failed (safely): a queued run
//     was never dispatched, so no external side effect occurred.
//   - "running" with no external_execution_id stale beyond EXECUTION_TIMEOUT_MS
//     → failed: under webhook dispatch n8n returns no synchronous execution id,
//     so a run that never produced a callback within the execution window is
//     terminalized as failed. This bounds runaway/stuck runs.
//   - "running" with an external_execution_id stale beyond STALE_MS → reconcile
//     against n8n (best effort). If n8n reports a finished execution the outcome
//     is synced; otherwise the run is deferred, never blindly re-dispatched.
//   - Otherwise → deferred (waiting for callback; do not mutate status).
//
// A successful dispatch is not treated as workflow success; the callback is the
// authoritative terminal signal, so recovery only ever:
//   (a) fails a run that was never dispatched, or
//   (b) reconciles a run whose external n8n state can be read safely.
// It never creates a second n8n execution.
//

const DEFAULT_STALE_MINUTES = 15
const DEFAULT_DISPATCH_TIMEOUT_MINUTES = 30
const DEFAULT_EXECUTION_TIMEOUT_MINUTES = 240
const RECOVERY_BATCH_LIMIT = 200

type RecoveryOptions = {
  staleMinutes?: number
  dispatchTimeoutMinutes?: number
  executionTimeoutMinutes?: number
}

export type RecoveryResult = {
  scanned: number
  recovered: number
  deferred: number
  skipped: number
  failed: number
}

type RunRow = {
  id: string
  organization_id: string
  workflow_id: string
  status: string
  external_execution_id: string | null
  recovery_attempts: number | null
}

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

function runAgeMinutes(lastActivityAt: string | null): number {
  if (!lastActivityAt) return Number.POSITIVE_INFINITY
  const age = Date.now() - new Date(lastActivityAt).getTime()
  if (Number.isNaN(age)) return Number.POSITIVE_INFINITY
  return age / 60000
}

async function recordEvent(
  supabase: ReturnType<typeof createAdminClient>,
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

async function terminalize(
  supabase: ReturnType<typeof createAdminClient>,
  run: RunRow,
  status: "failed" | "cancelled",
  errorCode: string | null,
  errorMessage: string,
  eventType: string,
) {
  if (!isWorkflowRunStatus(run.status)) return false
  if (!canTransitionRun(run.status, status)) return false

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("workflow_runs")
    .update({
      status,
      completed_at: now,
      last_activity_at: now,
      recovery_attempts: (run.recovery_attempts ?? 0) + 1,
      error_code: errorCode,
      error_message: errorMessage,
    })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id)
    .in("status", ["queued", "running"])

  if (error) {
    logError("automation.recovery", "Unable to terminalize run", error, {
      organization_id: run.organization_id,
      run_id: run.id,
    })
    return false
  }

  await recordEvent(supabase, run.organization_id, run.id, eventType, errorMessage, {
    error_code: errorCode ?? undefined,
    recovery: "timeout",
  })
  return true
}

export async function recoverStaleWorkflowRuns(
  options: RecoveryOptions = {},
): Promise<RecoveryResult> {
  const staleMinutes = Math.max(1, options.staleMinutes ?? DEFAULT_STALE_MINUTES)
  const dispatchTimeoutMinutes = Math.max(
    staleMinutes,
    options.dispatchTimeoutMinutes ?? DEFAULT_DISPATCH_TIMEOUT_MINUTES,
  )
  const executionTimeoutMinutes = Math.max(
    staleMinutes,
    options.executionTimeoutMinutes ?? DEFAULT_EXECUTION_TIMEOUT_MINUTES,
  )

  const supabase = createAdminClient()
  const staleBefore = minutesAgoIso(staleMinutes)

  const { data: runs, error } = await supabase
    .from("workflow_runs")
    .select(
      "id, organization_id, workflow_id, status, external_execution_id, recovery_attempts, last_activity_at",
    )
    .in("status", ["queued", "running"])
    .lt("last_activity_at", staleBefore)
    // Exhausted-attempt runs are still candidates so the hard timeouts below can
    // terminalize them instead of leaving them stuck forever.
    .order("last_activity_at", { ascending: true })
    .limit(RECOVERY_BATCH_LIMIT)

  if (error) {
    throw new Error(`Unable to load stale workflow runs: ${error.message}`)
  }

  const result: RecoveryResult = {
    scanned: runs?.length ?? 0,
    recovered: 0,
    deferred: 0,
    skipped: 0,
    failed: 0,
  }

  for (const run of (runs ?? []) as RunRow[]) {
    // Claim the run to avoid two concurrent recovery actors processing it.
    const { data: claimed, error: claimError } = await supabase
      .from("workflow_runs")
      .update({
        recovery_attempts: (run.recovery_attempts ?? 0) + 1,
        recovery_started_at: new Date().toISOString(),
        recovery_error: null,
      })
      .eq("id", run.id)
      .eq("organization_id", run.organization_id)
      .in("status", ["queued", "running"])
      .select("id, last_activity_at")
      .maybeSingle()

    if (claimError || !claimed) {
      result.skipped += 1
      continue
    }

    const ageMinutes = runAgeMinutes(claimed.last_activity_at)

    try {
      // 1) A run stuck in `queued` was never dispatched → safe to fail.
      if (run.status === "queued" && ageMinutes > dispatchTimeoutMinutes) {
        const ok = await terminalize(
          supabase,
          run,
          "failed",
          "DISPATCH_TIMEOUT",
          "Workflow run was never dispatched within the dispatch window.",
          "run.failed",
        )
        if (ok) result.failed += 1
        else result.skipped += 1
        continue
      }

      // 2) A `running` run with no external execution identity and no callback
      //    within the execution window → safe to terminalize as failed. This
      //    bounds runs that would otherwise remain stuck forever.
      if (
        run.status === "running" &&
        !run.external_execution_id &&
        ageMinutes > executionTimeoutMinutes
      ) {
        const ok = await terminalize(
          supabase,
          run,
          "failed",
          "EXECUTION_TIMEOUT",
          "Workflow execution did not complete within the execution window.",
          "run.failed",
        )
        if (ok) result.failed += 1
        else result.skipped += 1
        continue
      }

      // 3) Stale run with an external execution identity → reconcile against
      //    n8n (best effort). If n8n cannot be reached the run is deferred, and
      //    the hard execution timeout above will eventually terminalize it.
      if (
        run.status === "running" &&
        run.external_execution_id &&
        ageMinutes > staleMinutes
      ) {
        const outcome = await reconcileExecution(supabase, run)
        if (outcome === "reconciled") {
          result.recovered += 1
          continue
        }
        if (outcome === "deferred") {
          result.deferred += 1
          continue
        }
      }

      // 4) Fresh enough, or ambiguous → defer. Do NOT mutate terminal status and
      //    do NOT re-dispatch.
      await recordEvent(
        supabase,
        run.organization_id,
        run.id,
        "run.recovery_deferred",
        "Recovery detected a stale run and deferred final reconciliation.",
        {
          attempt: (run.recovery_attempts ?? 0) + 1,
          reason: run.external_execution_id
            ? "external_execution_reconciliation_required"
            : "waiting_for_callback",
        },
      )
      result.deferred += 1
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown recovery error."
      await supabase
        .from("workflow_runs")
        .update({ recovery_error: message })
        .eq("id", run.id)
        .eq("organization_id", run.organization_id)
      await recordEvent(
        supabase,
        run.organization_id,
        run.id,
        "run.recovery_failed",
        "Automated recovery attempt failed.",
        { attempt: (run.recovery_attempts ?? 0) + 1, error: message },
      )
      result.failed += 1
    }
  }

  return result
}

type ReconcileOutcome = "reconciled" | "deferred" | "skipped"

// Best-effort n8n execution reconciliation. If the external execution finished,
// sync its terminal outcome into workflow_runs. If n8n is unreachable or the
// execution is not finished, return deferred (never mark success/failure we
// cannot prove, and never re-dispatch).
async function reconcileExecution(
  supabase: ReturnType<typeof createAdminClient>,
  run: RunRow,
): Promise<ReconcileOutcome> {
  let n8nData: { status: string; finished: boolean } | null = null
  try {
    n8nData = await getN8nExecutionStatus(run.external_execution_id)
  } catch {
    n8nData = null
  }

  if (!n8nData || !n8nData.finished) {
    return "deferred"
  }

  const finalStatus: WorkflowRunStatus = n8nData.status === "cancelled" ? "cancelled" : "failed"
  const terminal = await terminalize(
    supabase,
    run,
    finalStatus,
    "RECONCILED_FROM_N8N",
    finalStatus === "cancelled"
      ? "Workflow execution was cancelled."
      : "Workflow execution failed according to n8n.",
    finalStatus === "cancelled" ? "run.cancelled" : "run.failed",
  )

  return terminal ? "reconciled" : "skipped"
}

export { runAgeMinutes }
