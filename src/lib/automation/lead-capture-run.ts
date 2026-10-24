// Lead-capture run orchestrator (dependency-injected, deterministic).
//
// This is the "vertical slice" that connects the pure lead engine to the
// existing durable-run conventions. It mirrors the established pattern from
// callback-apply.ts: a pure orchestrator that performs its Supabase operations
// through an INJECTED structural client, so it can be unit-tested against an
// in-memory fake with zero database writes, and production wiring can supply the
// real admin client.
//
// Responsibilities (all using existing conventions — no second queue/dispatcher):
// - validate + normalize + qualify the inbound lead (pure engine)
// - enqueue ONE durable `workflow_runs` row with `trigger_type = 'webhook'`,
//   a deterministic `idempotency_key` (so a resubmitted lead cannot double-queue
//   thanks to the existing (organization_id, idempotency_key) unique index), and
//   the normalized payload in `input`
// - move the run with the SAME atomic transition RPC the callback path uses
//   (public.apply_workflow_run_transition via atomic-transition.ts), so every
//   state change and its audit event commit in one transaction and every write
//   is a compare-and-set against the status this orchestrator observed
// - enforce the human approval gate: a hot lead is persisted as `queued` with
//   approval_state = 'pending' and is NOT delivered until an approver acts.
//   The recovery sweep excludes pending runs, so a pending approval is never
//   terminalized by a timeout (see recovery-service.ts and migration
//   20261005000000_workflow_run_approval_state.sql).
// - deliver the consequential step through the injected `NotificationAdapter`
//   (a MOCK in tests) and, on failure, mark the run `failed` with an actionable
//   error code/message
//
// It does NOT dispatch to n8n and it does NOT resolve runs from callbacks — that
// remains the job of execution-service.ts and the callback route.
//
// Audit payloads never contain the lead's PII (name/email/phone). The normalized
// lead lives in workflow_runs.input; events carry only tier/score/source and
// stable identifiers.

import type { LeadQualification, NormalizedLead } from "../leads/lead-capture"
import {
  buildLeadRunInput,
  leadCaptureOutput,
  leadIdempotencyKey,
  parseLeadCaptureInput,
  qualifyLead,
} from "../leads/lead-capture"
import { randomUUID } from "node:crypto"
import type { IntegrationDelivery, NotificationAdapter } from "./integration-adapter"
import {
  applyAtomicTransition,
  buildTransitionArgs,
  type AtomicTransitionClient,
  type AtomicTransitionRow,
} from "./atomic-transition"
import type { WorkflowRunStatus } from "./run-state-machine"

// The orchestrator needs `from(table)` for the run envelope + informational
// events, and `rpc` for atomic transitions. The real admin client satisfies both
// structurally; tests substitute an in-memory fake.
export type LeadCaptureClient = AtomicTransitionClient & {
  from: (table: string) => any
}

export type LeadCaptureLogger = (
  level: "error" | "warn" | "info",
  scope: string,
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>,
) => void

export type LeadCaptureContext = {
  organizationId: string
  projectId: string
  workflowId: string
  clientId: string | null
  /**
   * The authenticated user who resolved a human approval gate. Recorded in the
   * approval decision's audit event (`decided_by_user_id`) so every hot-lead
   * decision is attributable to a specific approver. Optional for backwards
   * compatibility: non-authenticated paths (tests, demos) omit it and the
   * event honestly records `null` ("no authenticated actor"), never a guess.
   */
  decidedByUserId?: string | null
}

export type LeadCaptureDeps = {
  supabase: LeadCaptureClient
  /** External-integration seam. A mock in tests; a real adapter in production. */
  notify: NotificationAdapter
  /** Injectable for deterministic ids/timestamps in tests. */
  newId?: () => string
  now?: () => Date
  log?: LeadCaptureLogger
}

export const LEAD_CAPTURE_ERROR_CODES = {
  integrationFailed: "INTEGRATION_DELIVERY_FAILED",
  enqueueFailed: "LEAD_ENQUEUE_FAILED",
  claimFailed: "LEAD_CLAIM_FAILED",
} as const

// Event types reused from the existing run-observability vocabulary where one
// exists; approval and delivery events are lead-capture specific and humanized
// by the UI. Event payloads carry only tier/score/source and stable ids — never
// the lead's PII.
export const LEAD_CAPTURE_EVENTS = {
  queued: "run.queued",
  dispatching: "run.dispatching",
  approvalRequired: "run.approval_required",
  approvalGranted: "run.approval_granted",
  integrationDelivered: "run.integration_delivered",
  succeeded: "run.succeeded",
  failed: "run.failed",
  cancelled: "run.cancelled",
} as const

export type LeadCaptureOutcome =
  | { outcome: "rejected"; errors: readonly string[] }
  | { outcome: "duplicate"; runId: string }
  | { outcome: "awaiting_approval"; runId: string; qualification: LeadQualification }
  | { outcome: "enqueued"; runId: string; qualification: LeadQualification; providerRef: string }
  | { outcome: "failed"; runId: string; errorCode: string; errorMessage: string }

export type LeadApprovalOutcome =
  | { outcome: "not_found" }
  | { outcome: "invalid_state"; runId: string; status: string }
  | { outcome: "cancelled"; runId: string }
  | { outcome: "approved"; runId: string; providerRef: string }
  | { outcome: "failed"; runId: string; errorCode: string; errorMessage: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isUniqueViolation(error: { code?: unknown } | null | undefined): boolean {
  return !!error && (error as { code?: unknown }).code === "23505"
}

/** The consequential step: hand the lead to the CRM integration. */
export function buildLeadNotification(lead: NormalizedLead): IntegrationDelivery {
  return {
    provider: "crm",
    operation: "notify",
    reference: lead.email,
    payload: {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      source: lead.source,
    },
  }
}

async function findByFingerprint(
  supabase: LeadCaptureClient,
  organizationId: string,
  idempotencyKey: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("workflow_runs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  if (error) throw new Error("Unable to check for an existing lead-capture run.")
  return data && typeof data.id === "string" ? data.id : null
}

/**
 * Append an informational (non-transition) event. State transitions use the
 * atomic RPC below so a terminal state can never be committed without its
 * event; this helper is only for markers that describe no state change.
 */
async function appendEvent(
  supabase: LeadCaptureClient,
  organizationId: string,
  runId: string,
  eventType: string,
  message: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from("workflow_run_events").insert({
    organization_id: organizationId,
    run_id: runId,
    event_type: eventType,
    message,
    payload,
  })
  if (error) throw new Error("Unable to record workflow run event.")
}

type TransitionSpec = {
  runId: string
  expected: WorkflowRunStatus
  to: WorkflowRunStatus
  eventType: string
  message: string
  payload?: Record<string, unknown>
  output?: unknown
  errorCode?: string | null
  errorMessage?: string | null
}

/**
 * Apply one run state change through the atomic transition RPC. Every write is a
 * compare-and-set against `expected`, so two concurrent actors serialize and the
 * loser writes nothing. A database error is raised (never swallowed), so a
 * caller never believes a run was settled when it was not.
 */
async function transition(
  deps: LeadCaptureDeps,
  context: LeadCaptureContext,
  spec: TransitionSpec,
): Promise<AtomicTransitionRow> {
  const now = (deps.now ?? (() => new Date()))().toISOString()
  const terminal = spec.to === "succeeded" || spec.to === "failed" || spec.to === "cancelled"

  const args = buildTransitionArgs({
    runId: spec.runId,
    organizationId: context.organizationId,
    patch: {
      status: spec.to,
      completed_at: terminal ? now : null,
      last_activity_at: now,
      output: spec.output,
      error_code: spec.errorCode ?? null,
      error_message: spec.errorMessage ?? null,
    },
    eventType: spec.eventType,
    eventMessage: spec.message,
    eventPayload: spec.payload ?? {},
    expectedStatus: spec.expected,
  })

  return applyAtomicTransition(args, {
    supabase: deps.supabase,
    log: (message, meta) =>
      (deps.log ?? (() => {}))("error", "lead-capture.transition", message, undefined, meta),
  })
}

// Claim a queued run for local execution: queued -> running.
async function claimRun(
  deps: LeadCaptureDeps,
  context: LeadCaptureContext,
  runId: string,
  options: {
    eventType: string
    message: string
    payload?: Record<string, unknown>
  },
): Promise<AtomicTransitionRow> {
  return transition(deps, context, {
    runId,
    expected: "queued",
    to: "running",
    eventType: options.eventType,
    message: options.message,
    payload: options.payload ?? { adapter: "local" },
  })
}

type DeliveryResult =
  | { ok: true; providerRef: string }
  | { ok: false; errorCode: string; errorMessage: string }

// Assumes the run is already `running`. Deliver, then settle the run terminal.
async function deliverFromRunning(
  deps: LeadCaptureDeps,
  context: LeadCaptureContext,
  runId: string,
  lead: NormalizedLead,
  qualification: LeadQualification,
): Promise<DeliveryResult> {
  const request = buildLeadNotification(lead)
  const delivery = await deps.notify.deliver(request)

  if (delivery.ok) {
    await transition(deps, context, {
      runId,
      expected: "running",
      to: "succeeded",
      eventType: LEAD_CAPTURE_EVENTS.integrationDelivered,
      message: "Lead delivered to the CRM integration.",
      payload: {
        provider: request.provider,
        operation: request.operation,
        provider_ref: delivery.providerRef,
      },
      output: leadCaptureOutput(lead, qualification),
    })
    return { ok: true, providerRef: delivery.providerRef }
  }

  const message = `Integration delivery failed: ${delivery.message}`
  await transition(deps, context, {
    runId,
    expected: "running",
    to: "failed",
    eventType: LEAD_CAPTURE_EVENTS.failed,
    message,
    payload: {
      error_code: LEAD_CAPTURE_ERROR_CODES.integrationFailed,
      provider: request.provider,
      reason: delivery.reason,
    },
    errorCode: LEAD_CAPTURE_ERROR_CODES.integrationFailed,
    errorMessage: message,
  })
  return {
    ok: false,
    errorCode: LEAD_CAPTURE_ERROR_CODES.integrationFailed,
    errorMessage: delivery.message,
  }
}

/**
 * Handle one inbound lead. Validates and qualifies first, then starts the
 * durable run. Returns a typed outcome; it never throws for a normal rejection
 * or business outcome, only for an unexpected persistence failure.
 */
export async function handleInboundLead(
  raw: unknown,
  context: LeadCaptureContext,
  deps: LeadCaptureDeps,
): Promise<LeadCaptureOutcome> {
  const log = deps.log ?? (() => {})
  const nowFn = deps.now ?? (() => new Date())
  const newId = deps.newId ?? (() => randomUUID())

  const parsed = parseLeadCaptureInput(raw)
  if (!parsed.ok) {
    return { outcome: "rejected", errors: parsed.errors }
  }

  const lead = parsed.value
  const qualification = qualifyLead(lead)
  const idempotencyKey = leadIdempotencyKey(lead)

  // Idempotency pre-check: the same lead must not create a second run. A
  // conflicting payload with the same identity (email+phone) is treated as the
  // same lead: the original run's stored input is never rewritten.
  const existingRunId = await findByFingerprint(
    deps.supabase,
    context.organizationId,
    idempotencyKey,
  )
  if (existingRunId) {
    return { outcome: "duplicate", runId: existingRunId }
  }

  const runId = newId()
  const timestamp = nowFn().toISOString()

  const { error: insertError } = await deps.supabase.from("workflow_runs").insert({
    id: runId,
    organization_id: context.organizationId,
    workflow_id: context.workflowId,
    project_id: context.projectId,
    client_id: context.clientId,
    status: "queued",
    trigger_type: "webhook",
    requested_by: null,
    idempotency_key: idempotencyKey,
    approval_state: qualification.requiresApproval ? "pending" : "none",
    input: buildLeadRunInput(lead, qualification),
    last_activity_at: timestamp,
  })

  if (insertError) {
    // A unique-violation means a concurrent submission won the race: treat it as
    // an idempotent duplicate rather than an error.
    if (isUniqueViolation(insertError)) {
      const raced = await findByFingerprint(
        deps.supabase,
        context.organizationId,
        idempotencyKey,
      )
      if (raced) return { outcome: "duplicate", runId: raced }
    }
    log("error", "lead-capture.run", "Unable to enqueue lead-capture run", insertError, {
      organization_id: context.organizationId,
      workflow_id: context.workflowId,
    })
    throw new Error("Unable to enqueue lead-capture run.")
  }

  await appendEvent(
    deps.supabase,
    context.organizationId,
    runId,
    LEAD_CAPTURE_EVENTS.queued,
    "Lead captured from webhook.",
    {
      trigger_type: "webhook",
      tier: qualification.tier,
      score: qualification.score,
      qualified: qualification.qualified,
      source: lead.source,
    },
  )

  // Human approval gate. A hot lead is recorded (approval_state = 'pending') and
  // NOT delivered until an approver acts (see decideLeadApproval). The recovery
  // sweep excludes pending runs, so this legitimate wait is never timed out.
  if (qualification.requiresApproval) {
    await appendEvent(
      deps.supabase,
      context.organizationId,
      runId,
      LEAD_CAPTURE_EVENTS.approvalRequired,
      "Hot lead requires owner approval before outreach.",
      { gate: "gate-hot-lead", role: "owner", tier: qualification.tier },
    )
    return { outcome: "awaiting_approval", runId, qualification }
  }

  const claim = await claimRun(deps, context, runId, {
    eventType: LEAD_CAPTURE_EVENTS.dispatching,
    message: "Lead-capture run started.",
    payload: { adapter: "local" },
  })
  if (claim.outcome !== "applied") {
    return {
      outcome: "failed",
      runId,
      errorCode: LEAD_CAPTURE_ERROR_CODES.claimFailed,
      errorMessage: `Run could not be claimed (${claim.outcome}).`,
    }
  }

  const delivery = await deliverFromRunning(deps, context, runId, lead, qualification)
  if (delivery.ok) {
    return { outcome: "enqueued", runId, qualification, providerRef: delivery.providerRef }
  }
  return {
    outcome: "failed",
    runId,
    errorCode: delivery.errorCode,
    errorMessage: delivery.errorMessage,
  }
}

/**
 * Resolve a pending approval gate for a hot lead. Only a run that is still
 * `queued` AND has approval_state = 'pending' can be resolved. The decision is
 * claimed with a compare-and-set, so concurrent or repeated decisions update
 * zero rows and the loser is refused without acting. `approved` performs the
 * consequential delivery; `rejected` cancels the run.
 */
export async function decideLeadApproval(
  runId: string,
  decision: "approved" | "rejected",
  context: LeadCaptureContext,
  deps: LeadCaptureDeps,
): Promise<LeadApprovalOutcome> {
  const { data: run, error } = await deps.supabase
    .from("workflow_runs")
    .select("id, organization_id, status, approval_state, input")
    .eq("id", runId)
    .eq("organization_id", context.organizationId)
    .maybeSingle()

  if (error) throw new Error("Unable to load lead-capture run.")
  if (!run) return { outcome: "not_found" }

  const status = typeof run.status === "string" ? run.status : "unknown"
  const approvalState = typeof run.approval_state === "string" ? run.approval_state : "none"

  if (status !== "queued" || approvalState !== "pending") {
    return { outcome: "invalid_state", runId, status }
  }

  // Atomic claim: flip the gate exactly once. This (status, approval_state)
  // predicate is a compare-and-set, so a concurrent or repeated decision matches
  // zero rows and is refused. Only the winner proceeds to act, so the
  // consequential delivery can never happen twice.
  const nextApprovalState = decision === "approved" ? "approved" : "rejected"
  const { data: claimed, error: claimError } = await deps.supabase
    .from("workflow_runs")
    .update({ approval_state: nextApprovalState })
    .eq("id", runId)
    .eq("organization_id", context.organizationId)
    .eq("status", "queued")
    .eq("approval_state", "pending")
    .select("id")
    .maybeSingle()

  if (claimError) throw new Error("Unable to claim lead-capture approval.")
  if (!claimed) return { outcome: "invalid_state", runId, status }

  if (decision === "rejected") {
    const settled = await transition(deps, context, {
      runId,
      expected: "queued",
      to: "cancelled",
      eventType: LEAD_CAPTURE_EVENTS.cancelled,
      message: "Lead outreach rejected by approver.",
      payload: { gate: "gate-hot-lead", decided_by_user_id: context.decidedByUserId ?? null },
    })
    if (settled.outcome !== "applied") {
      return { outcome: "invalid_state", runId, status: settled.status ?? status }
    }
    return { outcome: "cancelled", runId }
  }

  const input = isRecord(run.input) ? run.input : {}
  const lead = input.lead as NormalizedLead | undefined
  if (!lead || typeof lead.email !== "string") {
    // Defensive: a pending approval without its payload cannot be delivered.
    const claim = await transition(deps, context, {
      runId,
      expected: "queued",
      to: "failed",
      eventType: LEAD_CAPTURE_EVENTS.failed,
      message: "Approved lead is missing its normalized payload.",
      payload: { error_code: LEAD_CAPTURE_ERROR_CODES.integrationFailed },
      errorCode: LEAD_CAPTURE_ERROR_CODES.integrationFailed,
      errorMessage: "Approved lead is missing its normalized payload.",
    })
    if (claim.outcome !== "applied") {
      return { outcome: "invalid_state", runId, status: claim.status ?? status }
    }
    return {
      outcome: "failed",
      runId,
      errorCode: LEAD_CAPTURE_ERROR_CODES.integrationFailed,
      errorMessage: "Approved lead is missing its normalized payload.",
    }
  }

  const qualification: LeadQualification =
    (input.qualification as unknown as LeadQualification | undefined) ?? {
      qualified: true,
      score: 0,
      tier: "hot",
      businessEmail: false,
      requiresApproval: true,
      reasons: [],
    }

  const claim = await claimRun(deps, context, runId, {
    eventType: LEAD_CAPTURE_EVENTS.approvalGranted,
    message: "Lead outreach approved; starting delivery.",
    payload: {
      gate: "gate-hot-lead",
      decision: "approved",
      adapter: "local",
      decided_by_user_id: context.decidedByUserId ?? null,
    },
  })
  if (claim.outcome !== "applied") {
    return { outcome: "invalid_state", runId, status: claim.status ?? status }
  }

  const delivery = await deliverFromRunning(deps, context, runId, lead, qualification)
  if (delivery.ok) {
    return { outcome: "approved", runId, providerRef: delivery.providerRef }
  }
  return {
    outcome: "failed",
    runId,
    errorCode: delivery.errorCode,
    errorMessage: delivery.errorMessage,
  }
}
