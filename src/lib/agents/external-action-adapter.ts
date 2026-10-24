// External action adapter seam for consequential agent steps.
//
// Consequential steps (sending a message, creating a payment, applying a
// production change) are the only place an agent could touch the outside world.
// They are separated out here so that:
//   1. the default is UNCONFIGURED — the agent can plan such actions and ask for
//      approval, but it cannot actually perform them until an adapter is
//      deliberately wired and injected; and
//   2. no external call is ever faked: an unconfigured adapter returns a failure
//      the orchestrator records honestly.
//
// There is no HTTP client here. A real adapter (email provider, payment
// provider, deploy hook) must be added as a reviewed change with its own auth,
// idempotency and dry-run controls.

import type { AgentPlanStep } from "./types"

export type ExternalActionRequest = {
  organizationId: string
  taskId: string
  step: AgentPlanStep
  // The approved, PII-minimal payload for the action.
  payload: Record<string, unknown>
}

export type ExternalActionResult =
  | { ok: true; detail: string; reference: string | null }
  | { ok: false; errorCode: string; message: string }

export type ExternalActionAdapter = {
  readonly ref: string
  readonly configured: boolean
  perform(request: ExternalActionRequest): Promise<ExternalActionResult>
}

/**
 * The default adapter. It is intentionally not configured: any attempt to
 * perform a consequential action fails with a clear, honest error code so the
 * task is recorded as failed rather than pretending the action happened.
 */
export function createUnconfiguredExternalActionAdapter(): ExternalActionAdapter {
  return {
    ref: "unconfigured",
    configured: false,
    async perform(request) {
      return {
        ok: false,
        errorCode: "EXTERNAL_ACTION_UNCONFIGURED",
        message: `No external adapter is configured for tool "${request.step.tool}".`,
      }
    },
  }
}

/**
 * A test-only adapter that records requests and succeeds. It never leaves the
 * process. It exists so the approval → execute → succeed path can be tested
 * without any real external system.
 */
export function createMockExternalActionAdapter(): ExternalActionAdapter & {
  readonly performed: readonly ExternalActionRequest[]
} {
  const performed: ExternalActionRequest[] = []
  return {
    ref: "mock",
    configured: true,
    performed,
    async perform(request) {
      performed.push(request)
      return { ok: true, detail: `Mock executed ${request.step.tool}.`, reference: `mock-${performed.length}` }
    },
  }
}
