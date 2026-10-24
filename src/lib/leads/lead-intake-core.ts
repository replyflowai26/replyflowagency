// Pure validation + cryptography for the inbound lead intake endpoint.
//
// The lead intake endpoint is a machine-to-machine webhook: a landing page,
// form provider or automation posts a lead to ReplyFlow. To prove the caller is
// a trusted sender (and not an attacker injecting leads or replaying a request)
// the exact raw request body is signed with HMAC-SHA256 using a dedicated shared
// secret and delivered in the `x-replyflow-signature` header.
//
// Cryptography is deliberately NOT re-implemented here: it reuses the audited
// sign/verify primitives from the automation callback core, so both inbound
// surfaces share one HMAC scheme. This module is dependency-free beyond
// node:crypto and the callback core, and performs no I/O, so it is unit testable
// on its own.

import { createHmac } from "node:crypto"

import {
  CB_SIGNATURE_PREFIX,
  signCallbackPayload,
  verifyCallbackSignature,
} from "../automation/callback-core"

/** Header carrying the HMAC-SHA256 signature of the raw body. */
export const LEAD_INTAKE_SIGNATURE_HEADER = "x-replyflow-signature"

/** Environment variable holding the shared intake secret. */
export const LEAD_INTAKE_SECRET_ENV = "REPLYFLOW_LEAD_INTAKE_SECRET"

/**
 * Maximum accepted size of a raw lead intake body in UTF-8 bytes. A lead is
 * small (validated fields are individually capped at a few KB), so 32 KB is
 * generous; the limit exists only to reject oversized payloads before parsing.
 */
export const LEAD_INTAKE_MAX_BODY_BYTES = 32 * 1024

/**
 * Parse a `Content-Length` header into a non-negative integer, or null when it
 * is absent or malformed. A malformed value is treated as absent so the actual
 * body size is still checked.
 */
export function parseContentLength(header: string | null | undefined): number | null {
  if (typeof header !== "string" || header.trim() === "") return null
  const value = Number(header)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.trunc(value)
}

/**
 * Decide whether an inbound lead body is within the accepted size limit. The
 * declared Content-Length is checked first (to reject early, before reading) and
 * the actual byte length is checked again after reading, so a missing or
 * inaccurate Content-Length cannot be used to bypass the limit.
 */
export function isLeadIntakeBodyWithinLimit(
  declaredLength: number | null,
  byteLength: number,
): boolean {
  if (declaredLength !== null && declaredLength > LEAD_INTAKE_MAX_BODY_BYTES) return false
  return byteLength <= LEAD_INTAKE_MAX_BODY_BYTES
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

/**
 * The routing envelope around a lead. The destination (organization, project,
 * workflow) is explicit and validated; the lead fields themselves are validated
 * by the pure lead engine (parseLeadCaptureInput) in the orchestrator, so this
 * layer only guarantees a well-formed, routable envelope.
 */
export type LeadIntakeEnvelope = {
  organizationId: string
  projectId: string
  workflowId: string
  clientId: string | null
  lead: unknown
}

export type LeadIntakeParseResult =
  | { ok: true; envelope: LeadIntakeEnvelope }
  | { ok: false; error: string }

/**
 * Validate an already-parsed intake body. `raw` is the decoded JSON body
 * narrowed to `unknown`. Returns a typed envelope on success or a human-safe
 * error message on failure.
 */
export function parseLeadIntakeEnvelope(raw: unknown): LeadIntakeParseResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Lead intake payload must be a JSON object." }
  }

  const record = raw as Record<string, unknown>

  if (!isUuid(record.organization_id)) {
    return { ok: false, error: "Invalid organization id." }
  }
  if (!isUuid(record.project_id)) {
    return { ok: false, error: "Invalid project id." }
  }
  if (!isUuid(record.workflow_id)) {
    return { ok: false, error: "Invalid workflow id." }
  }

  let clientId: string | null = null
  const rawClient = record.client_id
  if (rawClient !== null && rawClient !== undefined && rawClient !== "") {
    if (!isUuid(rawClient)) {
      return { ok: false, error: "Invalid client id." }
    }
    clientId = rawClient
  }

  const lead = record.lead
  if (lead === null || typeof lead !== "object" || Array.isArray(lead)) {
    return { ok: false, error: "A lead object is required." }
  }

  return {
    ok: true,
    envelope: {
      organizationId: record.organization_id,
      projectId: record.project_id,
      workflowId: record.workflow_id,
      clientId,
      lead,
    },
  }
}

/** Compute the signature header value for a raw intake body. */
export function signLeadIntakePayload(secret: string, rawBody: string): string {
  return signCallbackPayload(secret, rawBody)
}

/**
 * Verify an incoming signature. Returns true only when the signature is present,
 * well-formed and cryptographically valid for the exact raw body.
 */
export function verifyLeadIntakeSignature(
  secret: string | undefined,
  rawBody: string,
  signatureHeader: string | null | undefined,
): boolean {
  return verifyCallbackSignature(secret, rawBody, signatureHeader)
}

/**
 * A stable, non-reversible correlation id for a raw body, derived from the
 * shared secret. Used ONLY for structured logging so two log lines about the
 * same request can be correlated without ever logging the body (which contains
 * lead PII). Never log or return the body itself.
 */
export function leadIntakeFingerprint(secret: string, rawBody: string): string {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  return `${CB_SIGNATURE_PREFIX}${digest.slice(0, 16)}`
}
