import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { logError, logEvent } from "@/lib/telemetry/logging"
import { CALLBACK_STATUSES, type CallbackPayload } from "@/lib/automation/callback-core"
import {
  applyCallbackToRun,
  type CallbackOutcome,
  type CallbackResult,
} from "@/lib/automation/callback-apply"

export type { CallbackOutcome, CallbackResult }

// Production wiring for the pure callback orchestrator (callback-apply.ts):
// the real admin client, the real callback secret from process.env, and the
// real structured logger. Security semantics are unchanged — the route still
// requires a valid HMAC signature before this function is reached.
function log(
  level: "error" | "warn" | "info",
  scope: string,
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>,
) {
  if (level === "error") {
    logError(scope, message, error instanceof Error ? error : undefined, meta)
  } else {
    logEvent(level, scope, message, meta)
  }
}

/**
 * Apply a verified n8n callback to the durable workflow_runs record using the
 * production admin client and callback secret. See `applyCallbackToRun` in
 * callback-apply.ts for the pure, deterministic implementation.
 */
export async function applyCallbackResult(payload: CallbackPayload): Promise<CallbackResult> {
  return applyCallbackToRun(payload, {
    supabase: createAdminClient(),
    secret: process.env.REPLYFLOW_CALLBACK_SECRET ?? "",
    log,
  })
}

export { CALLBACK_STATUSES }