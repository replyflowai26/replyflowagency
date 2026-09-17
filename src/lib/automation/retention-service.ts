import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

const DEFAULT_BATCH_LIMIT = 5000
const DEFAULT_RETENTION_DAYS = 90

type RetentionOptions = {
  batchLimit?: number
  retentionDays?: number
}

type RetentionResult = {
  purged: number
}

/**
 * Run the privileged event retention purge.
 *
 * Deletes only `workflow_run_events` rows whose parent `workflow_runs` row is
 * terminal (succeeded/failed/cancelled) and older than the retention window.
 * The authoritative `workflow_runs` records are never touched, and active
 * (queued/running) runs keep all of their events.
 *
 * Delegates to the SECURITY DEFINER function `public.purge_expired_run_events`
 * via the service-role client, which is the only role granted EXECUTE. The
 * function is idempotent and bounded to a single batch per call; the caller
 * may invoke it repeatedly to drain multiple batches with short transactions.
 */
export async function purgeExpiredRunEvents(
  options: RetentionOptions = {},
): Promise<RetentionResult> {
  const batchLimit = Math.max(1, options.batchLimit ?? DEFAULT_BATCH_LIMIT)
  const retentionDays = Math.max(1, options.retentionDays ?? DEFAULT_RETENTION_DAYS)

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc("purge_expired_run_events", {
    p_batch_limit: batchLimit,
    p_retention_days: retentionDays,
  })

  if (error) {
    throw new Error(`Unable to purge expired run events: ${error.message}`)
  }

  const purged = typeof data === "number" ? data : 0

  return { purged }
}
