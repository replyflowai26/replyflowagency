// Pure transition planner shared by every caller of the atomic transition RPC.
//
// The database function public.apply_workflow_run_transition (migration
// 20260917000011) is the authority that commits a run state change and its
// workflow_run_events audit record in one transaction. This module does NOT
// replace it: it derives the arguments and maps the returned outcome back onto
// the vocabulary the callers already use, and it stays dependency-free so the
// node test harness can exercise it with an in-memory fake and zero database
// writes.
//
// Two properties are deliberately preserved from the previous two-statement
// implementation:
//
// - A terminal run is never moved again and never gains a second terminal
//   event, so duplicate and replayed callbacks stay harmless.
// - Every write is a compare-and-set on the status the caller observed, so a
//   caller that lost a race is told it lost instead of overwriting a newer
//   state. The expected status is passed to the RPC, which re-checks it under
//   the row lock; the application-side check below is the cheap first pass.
//
// The event payload is assembled here and passed straight through, so the
// fingerprint-based audit metadata is recorded in the same transaction as the
// state change it describes.

import {
  isTerminalRunStatus,
  type WorkflowRunStatus,
} from "./run-state-machine"

import type { CallbackPayload } from "./callback-core"

/**
 * Outcomes returned by public.apply_workflow_run_transition. These mirror the
 * function's return contract exactly; anything else is treated as a database
 * failure and surfaced as an error so a partial write is never reported as
 * success.
 */
export const TRANSITION_OUTCOMES = [
  "applied",
  "already_terminal",
  "status_mismatch",
  "invalid_transition",
] as const

export type TransitionOutcome = (typeof TRANSITION_OUTCOMES)[number]

export type TransitionEventPatch = {
  status: WorkflowRunStatus
  completed_at?: string | null
  started_at?: string | null
  last_activity_at?: string | null
  external_execution_id?: string | null
  output?: unknown
  error_code?: string | null
  error_message?: string | null
}

export type AtomicTransitionArgs = {
  p_run_id: string
  p_organization_id: string
  p_to_status: string
  p_event_type: string
  p_expected_status: string | null
  p_event_message: string | null
  p_event_payload: Record<string, unknown>
  p_external_execution_id: string | null
  p_output: unknown
  p_error_code: string | null
  p_error_message: string | null
  p_completed_at: string | null
  p_started_at: string | null
  p_last_activity_at: string | null
}

/**
 * Structural shape of the single query this module issues. The real Supabase
 * admin client satisfies it, and the in-memory test fake implements the same
 * rpc() surface. Kept deliberately narrow so the fake stays small.
 *
 * `rpc` is declared as returning PromiseLike rather than Promise: the Supabase
 * client's rpc() hands back a PostgrestFilterBuilder, which is awaitable but is
 * not a Promise (it carries no catch/finally). PromiseLike is the accurate
 * contract for "awaitable that resolves to this result", and both that builder
 * and the test fake's async function satisfy it unchanged.
 */
export type AtomicTransitionClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

export type AtomicTransitionRow = {
  outcome: string
  run_id: string | null
  previous_status: string | null
  status: string | null
}

const TERMINAL = new Set(["succeeded", "failed", "cancelled"])

function isTerminalStatusText(status: string): boolean {
  return TERMINAL.has(status)
}

/**
 * Stable, non-sensitive identifiers for the stage a callback failure occurred
 * in. The callback route answers every one of these with the same generic 500,
 * so these codes exist purely so a developer running the stack locally can tell
 * the stages apart in the server log. They are constants on purpose: nothing
 * derived from a request body, a payload or a database row may reach this map.
 */
export const CALLBACK_DIAGNOSTIC_CODES = {
  runLoadFailed: "callback.run_load_failed",
  rpcError: "callback.rpc_error",
  rpcNoRow: "callback.rpc_no_row",
  unexpectedOutcome: "callback.unexpected_outcome",
} as const

export type CallbackDiagnostic = {
  code: string
  /**
   * PostgREST/Postgres error code such as "PGRST202" or "42501" — never the
   * accompanying message, which can echo schema detail.
   */
  databaseCode?: string
}

type CallbackDiagnosticCarrier = Error & {
  callbackDiagnostic?: CallbackDiagnostic
}

/**
 * Tag an error with its stage code without altering the message that callers
 * and the HTTP response already depend on.
 */
export function withCallbackDiagnostic(
  error: Error,
  code: string,
  databaseCode?: string,
): Error {
  const carrier = error as CallbackDiagnosticCarrier
  carrier.callbackDiagnostic = databaseCode ? { code, databaseCode } : { code }
  return error
}

/**
 * Keep only short, code-shaped tokens (PostgREST "PGRST202", Postgres "42501")
 * and drop anything else, so no free-form database text can reach a log line.
 */
function safeDatabaseCode(error: { message?: string } | null): string | undefined {
  if (!error) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === "string" && /^[A-Za-z0-9_]{1,32}$/.test(code)
    ? code
    : undefined
}

/**
 * Build the log-safe diagnostic fields for a caught callback failure.
 *
 * Returns an empty object in production, so the extra detail is confined to
 * local development. The fields are the error name, a length-capped message,
 * the stage code and an optional database error code — never a payload, a
 * secret, an authorization header or a row's contents.
 */
export function describeCallbackFailure(error: unknown): Record<string, string> {
  if (process.env.NODE_ENV === "production") return {}
  if (!(error instanceof Error)) return { code: "callback.unclassified" }

  const fields: Record<string, string> = {
    error_name: error.name,
    error_message: error.message.slice(0, 200),
  }
  const diagnostic = (error as CallbackDiagnosticCarrier).callbackDiagnostic
  if (diagnostic) {
    fields.code = diagnostic.code
    if (diagnostic.databaseCode) fields.database_code = diagnostic.databaseCode
  } else {
    fields.code = "callback.unclassified"
  }
  return fields
}

/**
 * Build the exact argument object for public.apply_workflow_run_transition.
 *
 * Only the columns the caller actually intends to change are populated; every
 * other argument stays null so the function's coalesce() defaults preserve the
 * existing row value. This keeps the RPC free to be reused by the callback path
 * and the recovery path without either one having to know about the other's
 * columns.
 */
export function buildTransitionArgs(input: {
  runId: string
  organizationId: string
  patch: TransitionEventPatch
  eventType: string
  eventMessage: string | null
  eventPayload: Record<string, unknown>
  /** The status the caller observed; drives the compare-and-set. */
  expectedStatus: string
}): AtomicTransitionArgs {
  const { patch } = input

  return {
    p_run_id: input.runId,
    p_organization_id: input.organizationId,
    p_to_status: patch.status,
    p_event_type: input.eventType,
    p_expected_status: input.expectedStatus,
    p_event_message: input.eventMessage,
    p_event_payload: input.eventPayload,
    p_external_execution_id: patch.external_execution_id ?? null,
    p_output: patch.status === "succeeded" ? (patch.output ?? null) : null,
    p_error_code: patch.error_code ?? null,
    p_error_message: patch.error_message ?? null,
    p_completed_at: patch.completed_at ?? null,
    p_started_at: patch.started_at ?? null,
    p_last_activity_at: patch.last_activity_at ?? null,
  }
}

/**
 * Normalize a row returned by the RPC. Supabase returns a bare array for a
 * function returning a table; a single-row result therefore arrives as a
 * one-element array.
 */
export function normalizeTransitionRows(data: unknown): AtomicTransitionRow[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({
      outcome: typeof row.outcome === "string" ? row.outcome : "unknown",
      run_id: typeof row.run_id === "string" ? row.run_id : null,
      previous_status:
        typeof row.previous_status === "string" ? row.previous_status : null,
      status: typeof row.status === "string" ? row.status : null,
    }))
}

export type ApplyTransitionDeps = {
  supabase: AtomicTransitionClient
  log?: (message: string, meta?: Record<string, unknown>) => void
}

/**
 * Issue the atomic transition. Returns the normalized row on success.
 *
 * A database error is raised, never converted into an outcome: because the
 * update and the audit insert share one transaction, an error means neither
 * record was committed, and the caller must retry rather than believe the run
 * was settled.
 */
export async function applyAtomicTransition(
  args: AtomicTransitionArgs,
  deps: ApplyTransitionDeps,
): Promise<AtomicTransitionRow> {
  const { data, error } = await deps.supabase.rpc(
    "apply_workflow_run_transition",
    args as unknown as Record<string, unknown>,
  )

  if (error) {
    deps.log?.("Atomic workflow run transition failed", {
      organization_id: args.p_organization_id,
      run_id: args.p_run_id,
      to_status: args.p_to_status,
      event_type: args.p_event_type,
      error_message: error.message,
    })
    throw withCallbackDiagnostic(
      new Error("Unable to apply workflow run transition."),
      CALLBACK_DIAGNOSTIC_CODES.rpcError,
      safeDatabaseCode(error),
    )
  }

  const [row] = normalizeTransitionRows(data)

  if (!row) {
    deps.log?.("Atomic workflow run transition returned no row", {
      organization_id: args.p_organization_id,
      run_id: args.p_run_id,
      to_status: args.p_to_status,
    })
    throw withCallbackDiagnostic(
      new Error("Unable to apply workflow run transition."),
      CALLBACK_DIAGNOSTIC_CODES.rpcNoRow,
    )
  }

  return row
}

/**
 * Decide whether a callback should be forwarded to the RPC at all.
 *
 * This is the cheap pre-check that keeps duplicate deliveries off the database
 * entirely: a terminal run is already settled, so there is nothing to attempt.
 * The RPC re-checks the same condition under the row lock, so this is an
 * optimization and never the security boundary.
 */
export function shouldAttemptTransition(currentStatus: string): boolean {
  if (isTerminalRunStatus(currentStatus as WorkflowRunStatus)) return false
  return !isTerminalStatusText(currentStatus)
}

/**
 * Map an n8n callback status onto the run status it resolves to, reusing the
 * single mapping the state machine already defines. Returns null for a status
 * that does not resolve to a run outcome.
 */
export function callbackTargetStatus(
  payload: Pick<CallbackPayload, "status">,
): WorkflowRunStatus | null {
  switch (payload.status) {
    case "success":
      return "succeeded"
    case "error":
      return "failed"
    case "cancelled":
      return "cancelled"
    default:
      return null
  }
}