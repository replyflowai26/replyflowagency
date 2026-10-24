// Pure authorization + request parsing for the authenticated lead-approval
// server action.
//
// This module is the security core of the human-approval surface. It is
// deliberately dependency-free and performs no I/O, so the authorization rules
// can be unit tested exhaustively without a database or a session.
//
// The rules it encodes (never trust the client):
//
//   - The caller must be authenticated (a resolved user id).
//   - The caller must be a member of an organization whose role is an APPROVER
//     role (owner/admin). A plain "member" cannot resolve a hot-lead gate.
//   - The run being resolved must belong to the caller's organization AND to the
//     project named in the request. A cross-tenant or cross-project reference is
//     reported as "not found" so the existence of another tenant's run is never
//     disclosed.
//   - The run must still be queued with approval_state = 'pending'. Anything else
//     is a stale/duplicate decision and is refused without acting.
//
// The client never supplies an organization id, a role, a status or an approval
// state; those are read server-side. The request carries only the target run id,
// its project id and the decision.
//
// The orchestrator (decideLeadApproval) remains the atomic authority: this gate
// is the cheap first pass, and the compare-and-set inside the orchestrator is
// what guarantees a decision is applied exactly once.

import type { LeadApprovalOutcome } from "./lead-capture-run"

/** The only decisions the approval surface accepts. */
export const LEAD_APPROVAL_DECISIONS = ["approved", "rejected"] as const

export type LeadApprovalDecision = (typeof LEAD_APPROVAL_DECISIONS)[number]

/**
 * Roles permitted to resolve a hot-lead approval gate. Kept intentionally
 * narrower than the roles that can merely run workflows: approving a
 * consequential outbound contact is an owner/admin decision.
 */
export const LEAD_APPROVAL_APPROVER_ROLES = ["owner", "admin"] as const

export const LEAD_APPROVAL_ERROR_CODES = {
  unauthenticated: "LEAD_APPROVAL_UNAUTHENTICATED",
  forbidden: "LEAD_APPROVAL_FORBIDDEN",
  invalid: "LEAD_APPROVAL_INVALID_REQUEST",
  notFound: "LEAD_APPROVAL_NOT_FOUND",
  invalidState: "LEAD_APPROVAL_INVALID_STATE",
  failed: "LEAD_APPROVAL_FAILED",
  rejected: "LEAD_APPROVAL_REJECTED",
} as const

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim())
}

export function isLeadApprovalDecision(value: unknown): value is LeadApprovalDecision {
  return (
    typeof value === "string" &&
    (LEAD_APPROVAL_DECISIONS as readonly string[]).includes(value)
  )
}

export function isApproverRole(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (LEAD_APPROVAL_APPROVER_ROLES as readonly string[]).includes(value)
  )
}

export type LeadApprovalRequest =
  | { ok: true; projectId: string; runId: string; decision: LeadApprovalDecision }
  | { ok: false; error: string }

/**
 * Validate the raw, client-supplied request. Only three fields are accepted:
 * the project id (which the run must belong to), the run id and the decision.
 * Any organization id, role or status a client tries to include is ignored —
 * those are always resolved server-side.
 */
export function parseLeadApprovalRequest(raw: unknown): LeadApprovalRequest {
  if (!isRecord(raw)) {
    return { ok: false, error: "Invalid approval request." }
  }

  const projectId = raw.projectId
  const runId = raw.runId
  const decision = raw.decision

  if (!isUuid(projectId)) {
    return { ok: false, error: "Invalid project reference." }
  }
  if (!isUuid(runId)) {
    return { ok: false, error: "Invalid run reference." }
  }
  if (!isLeadApprovalDecision(decision)) {
    return { ok: false, error: "Decision must be approved or rejected." }
  }

  return {
    ok: true,
    projectId: projectId.trim(),
    runId: runId.trim(),
    decision,
  }
}

/** The authenticated actor, resolved from the session + membership. */
export type LeadApprovalActor = {
  userId: string | null
  membershipOrganizationId: string | null
  membershipRole: string | null
}

/** The server-read facts about the run being resolved. */
export type LeadApprovalRunFacts = {
  organizationId: string
  projectId: string
  workflowId: string
  clientId: string | null
  status: string
  approvalState: string
}

export type LeadApprovalAuthorization =
  | { ok: true; run: LeadApprovalRunFacts }
  | { ok: false; code: string; status: number; error: string }

/**
 * Decide whether the actor may resolve the referenced approval. Pure: it takes
 * the already-fetched run facts (or null when the RLS-scoped lookup found
 * nothing) and returns either an authorization failure or the validated run.
 */
export function authorizeLeadApproval(input: {
  actor: LeadApprovalActor
  expectedProjectId: string
  run: LeadApprovalRunFacts | null
}): LeadApprovalAuthorization {
  const { actor, expectedProjectId, run } = input

  if (!actor.userId) {
    return {
      ok: false,
      code: LEAD_APPROVAL_ERROR_CODES.unauthenticated,
      status: 401,
      error: "Authentication required.",
    }
  }

  if (!actor.membershipOrganizationId || !isApproverRole(actor.membershipRole)) {
    return {
      ok: false,
      code: LEAD_APPROVAL_ERROR_CODES.forbidden,
      status: 403,
      error: "You do not have permission to resolve this approval.",
    }
  }

  // A missing run, a run in another organization and a run in another project
  // are all reported identically so a caller cannot probe for the existence of
  // another tenant's resources. The lookup is already organization-scoped under
  // RLS, so a cross-tenant row simply is not returned.
  if (
    !run ||
    run.organizationId !== actor.membershipOrganizationId ||
    run.projectId !== expectedProjectId
  ) {
    return {
      ok: false,
      code: LEAD_APPROVAL_ERROR_CODES.notFound,
      status: 404,
      error: "Approval request not found.",
    }
  }

  if (run.status !== "queued" || run.approvalState !== "pending") {
    return {
      ok: false,
      code: LEAD_APPROVAL_ERROR_CODES.invalidState,
      status: 409,
      error: "This approval is no longer pending.",
    }
  }

  return { ok: true, run }
}

export type LeadApprovalActionResponse =
  | { ok: true; outcome: "approved" | "cancelled"; runId: string; providerRef?: string }
  | { ok: false; code: string; status: number; error: string }

/**
 * Map the orchestrator's typed outcome onto the action's typed response. A
 * provider failure is reported with a stable, non-revealing message: the raw
 * provider error stays in the run's error fields and the server log, never in
 * the response returned to the browser.
 */
export function leadApprovalResponseForOutcome(
  outcome: LeadApprovalOutcome,
): LeadApprovalActionResponse {
  switch (outcome.outcome) {
    case "approved":
      return {
        ok: true,
        outcome: "approved",
        runId: outcome.runId,
        providerRef: outcome.providerRef,
      }
    case "cancelled":
      return { ok: true, outcome: "cancelled", runId: outcome.runId }
    case "not_found":
      return {
        ok: false,
        code: LEAD_APPROVAL_ERROR_CODES.notFound,
        status: 404,
        error: "Approval request not found.",
      }
    case "invalid_state":
      return {
        ok: false,
        code: LEAD_APPROVAL_ERROR_CODES.invalidState,
        status: 409,
        error: "This approval is no longer pending.",
      }
    case "failed":
      return {
        ok: false,
        code: LEAD_APPROVAL_ERROR_CODES.failed,
        status: 502,
        error: "The lead could not be delivered.",
      }
  }
}
