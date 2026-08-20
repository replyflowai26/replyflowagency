import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

const DEFAULT_STALE_MINUTES = 15
const DEFAULT_MAX_ATTEMPTS = 3

type RecoveryOptions = {
  staleMinutes?: number
  maxAttempts?: number
}

type RecoveryResult = {
  scanned: number
  recovered: number
  deferred: number
  skipped: number
  failed: number
}

function getRecoveryThreshold(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

export async function recoverStaleWorkflowRuns(
  options: RecoveryOptions = {},
): Promise<RecoveryResult> {
  const staleMinutes = Math.max(
    1,
    options.staleMinutes ?? DEFAULT_STALE_MINUTES,
  )
  const maxAttempts = Math.max(
    1,
    options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
  )

  const supabase = createAdminClient()
  const staleBefore = getRecoveryThreshold(staleMinutes)

  const { data: runs, error } = await supabase
    .from("workflow_runs")
    .select(
      "id, organization_id, workflow_id, project_id, status, external_execution_id, recovery_attempts, recovery_started_at, last_activity_at",
    )
    .in("status", ["queued", "running"])
    .lt("last_activity_at", staleBefore)
    .lt("recovery_attempts", maxAttempts)
    .order("last_activity_at", { ascending: true })
    .limit(100)

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

  for (const run of runs ?? []) {
    const recoveryStartedAt = new Date().toISOString()
    const nextAttempt = (run.recovery_attempts ?? 0) + 1

    const { data: claimedRun, error: claimError } = await supabase
      .from("workflow_runs")
      .update({
        recovery_attempts: nextAttempt,
        recovery_started_at: recoveryStartedAt,
        recovery_error: null,
      })
      .eq("id", run.id)
      .eq("organization_id", run.organization_id)
      .in("status", ["queued", "running"])
      .lt("last_activity_at", staleBefore)
      .lt("recovery_attempts", maxAttempts)
      .select("id")
      .maybeSingle()

    if (claimError || !claimedRun) {
      result.skipped += 1
      continue
    }

    try {
      const { error: startEventError } = await supabase
        .from("workflow_run_events")
        .insert({
          organization_id: run.organization_id,
          run_id: run.id,
          event_type: "run.recovery_started",
          message: "Automated recovery attempt started.",
          payload: {
            attempt: nextAttempt,
            stale_minutes: staleMinutes,
            external_execution_id: run.external_execution_id,
            previous_status: run.status,
          },
        })

      if (startEventError) {
        throw new Error(
          `Unable to record recovery start event: ${startEventError.message}`,
        )
      }

      // Recovery does not mutate run status or activity until an external
      // execution reconciliation adapter confirms the actual outcome.
      const { error: deferredEventError } = await supabase
        .from("workflow_run_events")
        .insert({
          organization_id: run.organization_id,
          run_id: run.id,
          event_type: "run.recovery_deferred",
          message:
            "Recovery detected a stale run and deferred final reconciliation.",
          payload: {
            attempt: nextAttempt,
            reason: run.external_execution_id
              ? "external_execution_reconciliation_required"
              : "dispatch_reconciliation_required",
            external_execution_id: run.external_execution_id,
          },
        })

      if (deferredEventError) {
        throw new Error(
          `Unable to record recovery deferral: ${deferredEventError.message}`,
        )
      }

      result.deferred += 1
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown recovery error."

      await supabase
        .from("workflow_runs")
        .update({ recovery_error: message })
        .eq("id", run.id)
        .eq("organization_id", run.organization_id)

      await supabase.from("workflow_run_events").insert({
        organization_id: run.organization_id,
        run_id: run.id,
        event_type: "run.recovery_failed",
        message: "Automated recovery attempt failed.",
        payload: { attempt: nextAttempt, error: message },
      })

      result.failed += 1
    }
  }

  return result
}
