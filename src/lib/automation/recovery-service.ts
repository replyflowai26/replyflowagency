import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

const DEFAULT_RECOVERY_TIMEOUT_MS = 10 * 60 * 1000
const DEFAULT_MAX_ATTEMPTS = 3

export type RecoverySummary = {
  scanned: number
  requeued: number
  failed: number
}

export async function recoverStuckWorkflowRuns(): Promise<RecoverySummary> {
  const supabase = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()

  const { data: candidates, error: queryError } = await supabase
    .from("workflow_runs")
    .select("id, organization_id, status, attempt_count, max_attempts")
    .eq("status", "running")
    .not("execution_timeout_at", "is", null)
    .lt("execution_timeout_at", nowIso)
    .order("execution_timeout_at", { ascending: true })
    .limit(100)

  if (queryError) throw new Error("Unable to load stuck workflow runs.")

  let requeued = 0
  let failed = 0

  for (const run of candidates ?? []) {
    const attemptCount = Math.max(0, run.attempt_count ?? 0)
    const maxAttempts = Math.max(1, run.max_attempts ?? DEFAULT_MAX_ATTEMPTS)
    const nextAttempt = attemptCount + 1

    if (nextAttempt >= maxAttempts) {
      const { error } = await supabase
        .from("workflow_runs")
        .update({
          status: "failed",
          completed_at: nowIso,
          execution_timeout_at: null,
          error_code: "EXECUTION_TIMEOUT",
          error_message: `Workflow execution timed out after ${maxAttempts} attempts.`,
        })
        .eq("id", run.id)
        .eq("organization_id", run.organization_id)
        .eq("status", "running")

      if (!error) {
        failed += 1
        await supabase.from("workflow_run_events").insert({
          organization_id: run.organization_id,
          run_id: run.id,
          event_type: "run.recovery_failed",
          message: "Workflow run exceeded its recovery attempt limit.",
          payload: { attempt_count: attemptCount, max_attempts: maxAttempts },
        })
      }

      continue
    }

    const timeoutAt = new Date(now.getTime() + DEFAULT_RECOVERY_TIMEOUT_MS).toISOString()
    const { error } = await supabase
      .from("workflow_runs")
      .update({
        status: "queued",
        attempt_count: nextAttempt,
        execution_timeout_at: timeoutAt,
        error_code: null,
        error_message: null,
        started_at: null,
        completed_at: null,
      })
      .eq("id", run.id)
      .eq("organization_id", run.organization_id)
      .eq("status", "running")

    if (!error) {
      requeued += 1
      await supabase.from("workflow_run_events").insert({
        organization_id: run.organization_id,
        run_id: run.id,
        event_type: "run.recovered",
        message: "Timed-out workflow run requeued for another execution attempt.",
        payload: { attempt_count: nextAttempt, max_attempts: maxAttempts },
      })
    }
  }

  return { scanned: candidates?.length ?? 0, requeued, failed }
}
