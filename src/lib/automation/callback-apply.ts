// Pure orchestrator that applies a verified n8n callback to the durable
// workflow_runs record.
//
// This module is dependency-free (no "server-only", no @supabase import, no
// telemetry) so it can be exercised deterministically by a node test harness
// with an in-memory Supabase substitute and zero real database writes.
// Production wiring — the real admin client, the real structured logger and
// the callback secret from process.env — is injected by callback-service.ts.
//
// Security properties:
// - The run is looked up by (id, organization_id) — the payload's org id is
//   part of the lookup key, so a callback can never select another
//   organization's run.
// - The payload's workflow_id must match the run's workflow_id, tying the
//   callback to the exact workflow that was dispatched.
// - The transition is validated by the central state machine before the write is
//   attempted, and the database re-validates it under a row lock.
// - A terminal run is never moved again (making duplicate callbacks harmless);
//   the RPC reports that as `already_terminal` without writing.
// - The transition and its workflow_run_events audit record are committed by a
//   single RPC call, so a terminal state can never be committed without the
//   event that documents it.
// - The write is a compare-and-set on the observed status, enforced inside the
//   RPC under the row lock, so two concurrent deliveries cannot both apply: the
//   loser is told it lost, writes nothing and emits no timeline event.
// - A database failure is raised as an error rather than reported as
//   `not_found`, so the route's 404 means only "no such run" and a transient
//   failure stays retryable instead of being silently dropped.
//
// The caller (the route handler) is responsible for HMAC signature
// verification and payload parsing before invoking this function.

import { callbackFingerprint, type CallbackPayload } from "./callback-core"
import {
  isWorkflowRunStatus,
  isTerminalRunStatus,
  canTransitionRun,
} from "./run-state-machine"
import {
  applyAtomicTransition,
  buildTransitionArgs,
  callbackTargetStatus,
  shouldAttemptTransition,
  withCallbackDiagnostic,
  CALLBACK_DIAGNOSTIC_CODES,
  type AtomicTransitionClient,
} from "./atomic-transition"

export type CallbackOutcome =
  | "applied"
  | "already_terminal"
  | "status_mismatch"
  | "not_found"
  | "forge_attempt"

export type CallbackResult = {
  outcome: CallbackOutcome
  runId: string | null
  status: string | null
}

// Minimal structural shape of the Supabase client this module needs. The real
// admin client (from @/lib/supabase/admin) satisfies it structurally, and tests
// substitute an in-memory fake that serves the same two operations this module
// performs: a read of the run row, and the atomic transition RPC.
export type CallbackClient = AtomicTransitionClient & {
  from: (table: string) => any
}

export type CallbackLogger = (
  level: "error" | "warn" | "info",
  scope: string,
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>,
) => void

export type CallbackApplyDeps = {
  supabase: CallbackClient
  /** Shared callback secret used to derive the audit fingerprint. */
  secret: string
  /** Best-effort logger; defaults to a no-op so this module stays pure. */
  log?: CallbackLogger
}

// mapCallbackStatusToRun is replaced by callbackTargetStatus from
// atomic-transition to keep the mapping in a single, shared location.

/**
 * Apply a verified n8n callback to the durable workflow_runs record using the
 * injected client, secret and logger. Pure and deterministic: it never speaks
 * to the network and never reads configuration itself.
 */
export async function applyCallbackToRun(
  payload: CallbackPayload,
  deps: CallbackApplyDeps,
): Promise<CallbackResult> {
  const supabase = deps.supabase
  const log = deps.log ?? (() => {})

  const fingerprint = callbackFingerprint(deps.secret, payload)

  const { data: run, error: loadError } = await supabase
    .from("workflow_runs")
    .select("id, organization_id, workflow_id, status, external_execution_id, output")
    .eq("id", payload.replyflow_run_id)
    .eq("organization_id", payload.organization_id)
    .maybeSingle()

  if (loadError) {
    log("error", "callback.apply", "Unable to load run for callback", loadError, {
      organization_id: payload.organization_id,
      run_id: payload.replyflow_run_id,
      fingerprint,
    })
    // A failed read is NOT a missing run. Reporting `not_found` here would make
    // the route answer 404, which the caller treats as permanently
    // undeliverable, silently dropping the terminal result and leaving the run
    // stuck in a non-terminal state. Surface it as a server error instead, so
    // `not_found` keeps exactly one meaning: the run genuinely does not exist.
    throw withCallbackDiagnostic(
      new Error("Unable to load workflow run."),
      CALLBACK_DIAGNOSTIC_CODES.runLoadFailed,
    )
  }

  if (!run) {
    return { outcome: "not_found", runId: payload.replyflow_run_id, status: null }
  }

  // The callback must reference the exact workflow that owns this run. A
  // mismatch is a strong forgery signal and is rejected outright.
  if (run.workflow_id !== payload.workflow_id) {
    log("error", "callback.apply", "Callback workflow mismatch", undefined, {
      organization_id: payload.organization_id,
      run_id: run.id,
      expected_workflow: run.workflow_id,
      received_workflow: payload.workflow_id,
      fingerprint,
    })
    return { outcome: "forge_attempt", runId: run.id, status: run.status }
  }

  if (!isWorkflowRunStatus(run.status)) {
    return { outcome: "status_mismatch", runId: run.id, status: run.status }
  }

  const to = callbackTargetStatus(payload)
  if (!to) {
    return { outcome: "status_mismatch", runId: run.id, status: run.status }
  }

  // Idempotency: if the run already reached a terminal state a duplicate
  // callback is a no-op. Never push a terminal run out of its state.
  if (isTerminalRunStatus(run.status)) {
    return { outcome: "already_terminal", runId: run.id, status: run.status }
  }

  if (!canTransitionRun(run.status, to)) {
    return { outcome: "status_mismatch", runId: run.id, status: run.status }
  }

  const now = new Date().toISOString()

  // Cheap first check: if the app's view already says terminal, skip the RPC.
  if (!shouldAttemptTransition(run.status)) {
    return { outcome: "already_terminal", runId: run.id, status: run.status }
  }

  const eventMeta: Record<string, unknown> = {
    execution_id: payload.execution_id ?? undefined,
    fingerprint,
  }
  if (to === "failed" && payload.error_code) eventMeta.error_code = payload.error_code

  const eventType = to === "succeeded" ? "run.succeeded" : to === "cancelled" ? "run.cancelled" : "run.failed"
  const message =
    to === "succeeded"
      ? "Workflow execution completed successfully."
      : to === "cancelled"
        ? "Workflow execution was cancelled."
        : "Workflow execution returned an error."

  let patchOutput: unknown = null
  if (to === "succeeded") {
    patchOutput = payload.output ?? run.output ?? null
  }

  let errorCode: string | null = null
  let errorMessage: string | null = null
  if (to === "failed") {
    errorCode = payload.error_code ?? "CALLBACK_ERROR"
    errorMessage = payload.error_message ?? "Workflow reported an error."
  }

  const transitionArgs = buildTransitionArgs({
    runId: run.id,
    organizationId: run.organization_id,
    patch: {
      status: to,
      completed_at: to === "succeeded" || to === "failed" || to === "cancelled" ? now : null,
      last_activity_at: now,
      external_execution_id: payload.execution_id ?? run.external_execution_id,
      output: patchOutput,
      error_code: errorCode,
      error_message: errorMessage,
    },
    eventType,
    eventMessage: message,
    eventPayload: eventMeta,
    expectedStatus: run.status,
  })

  const resultRow = await applyAtomicTransition(transitionArgs, {
    supabase,
    log: (messageText, meta) => {
      log("error", "callback.apply", messageText, undefined, meta)
    },
  })

  switch (resultRow.outcome) {
    case "applied":
      return { outcome: "applied", runId: run.id, status: to }
    case "already_terminal":
      return { outcome: "already_terminal", runId: run.id, status: resultRow.status ?? run.status }
    case "status_mismatch":
    case "invalid_transition":
      return { outcome: "status_mismatch", runId: run.id, status: resultRow.status ?? run.status }
    default:
      throw withCallbackDiagnostic(
        new Error("Unable to apply workflow run transition."),
        CALLBACK_DIAGNOSTIC_CODES.unexpectedOutcome,
      )
  }
}