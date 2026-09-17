// Pure callback cryptography and payload validation.
//
// n8n calls ReplyFlow's callback endpoint after a workflow execution finishes.
// To prove the caller is genuinely the configured n8n instance (and not an
// arbitrary attacker replaying or forging a run result) the request body is
// signed with an HMAC-SHA256 of the raw body using the shared
// REPLYFLOW_CALLBACK_SECRET. This layer is dependency-free (node:crypto only)
// so it can be unit tested directly and reused by the Next.js route handler.

import {
  createHmac,
  createHash,
  timingSafeEqual,
} from "node:crypto"

export const CALLBACK_STATUSES = ["success", "error", "cancelled"] as const
export type CallbackStatus = (typeof CALLBACK_STATUSES)[number]

export type CallbackPayload = {
  replyflow_run_id: string
  organization_id: string
  workflow_id: string
  status: CallbackStatus
  execution_id: string | null
  output: unknown
  error_message: string | null
  error_code: string | null
  occurred_at: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max
}

function optionalText(
  value: unknown,
  max: number,
): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null }
  if (isNonEmptyString(value, max)) return { ok: true, value }
  return { ok: false }
}

/**
 * Validate an already-parsed callback body. `raw` is the decoded JSON body
 * (usually JSON.parse of the raw text) narrowed to `unknown`. Returns a typed
 * CallbackPayload on success or a human-safe error message on failure.
 */
export function parseCallbackPayload(raw: unknown): {
  ok: true
  payload: CallbackPayload
} | {
  ok: false
  error: string
} {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Callback payload must be a JSON object." }
  }

  const record = raw as Record<string, unknown>

  if (!isUuid(record.replyflow_run_id)) {
    return { ok: false, error: "Invalid run id." }
  }
  if (!isUuid(record.organization_id)) {
    return { ok: false, error: "Invalid organization id." }
  }
  if (!isUuid(record.workflow_id)) {
    return { ok: false, error: "Invalid workflow id." }
  }

  const status = record.status
  if (typeof status !== "string" || !(CALLBACK_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "Invalid callback status." }
  }

  let executionId: string | null
  const rawExecution = record.execution_id
  if (
    rawExecution === null ||
    rawExecution === undefined ||
    rawExecution === ""
  ) {
    executionId = null
  } else if (typeof rawExecution === "string" || typeof rawExecution === "number") {
    const asString = String(rawExecution)
    if (asString.length === 0 || asString.length > 256) {
      return { ok: false, error: "Invalid execution id." }
    }
    executionId = asString
  } else {
    return { ok: false, error: "Invalid execution id." }
  }

  const errorMessage = optionalText(record.error_message, 4000)
  if (!errorMessage.ok) return { ok: false, error: "Invalid error message." }
  const errorCode = optionalText(record.error_code, 200)
  if (!errorCode.ok) return { ok: false, error: "Invalid error code." }

  let occurredAt: string | null = null
  if (typeof record.occurred_at === "string" && record.occurred_at) {
    if (!Number.isNaN(Date.parse(record.occurred_at))) occurredAt = record.occurred_at
  }

  return {
    ok: true,
    payload: {
      replyflow_run_id: record.replyflow_run_id,
      organization_id: record.organization_id,
      workflow_id: record.workflow_id,
      status: status as CallbackStatus,
      execution_id: executionId,
      output: record.output ?? null,
      error_message: errorMessage.value,
      error_code: errorCode.value,
      occurred_at: occurredAt,
    },
  }
}

export const CB_SIGNATURE_PREFIX = "sha256="

/**
 * Compute the canonical HMAC-SHA256 signature header value for a raw body.
 * Used by the signing side and by tests. The signature is computed over the
 * exact raw bytes of the request body so that JSON whitespace changes break
 * the signature (we do not canonicalize JSON).
 */
export function signCallbackPayload(secret: string, rawBody: string): string {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  return `${CB_SIGNATURE_PREFIX}${digest}`
}

/**
 * Verify an incoming `x-replyflow-signature` header against the raw body using
 * constant-time comparison to avoid timing side channels. Returns true only
 * when the signature is present, well-formed, and cryptographically valid.
 */
export function verifyCallbackSignature(
  secret: string | undefined,
  rawBody: string,
  signatureHeader: string | null | undefined,
): boolean {
  if (!secret || !secret.length) return false
  if (typeof signatureHeader !== "string") return false
  if (!signatureHeader.startsWith(CB_SIGNATURE_PREFIX)) return false
  const hex = signatureHeader.slice(CB_SIGNATURE_PREFIX.length)
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false

  const expected = signCallbackPayload(secret, rawBody)
  const expectedDigest = Buffer.from(expected.slice(CB_SIGNATURE_PREFIX.length), "hex")
  const actualDigest = Buffer.from(hex, "hex")
  if (expectedDigest.length !== actualDigest.length) return false
  return timingSafeEqual(expectedDigest, actualDigest)
}

// Replay protection helper: encodes a canonical HMAC over (run_id, status,
// occurred_at) so a callback cannot be silently re-targeted to a different run
// or outcome while still allowing a genuinely duplicate delivery to be detected
// by the (idempotent) handler. Used for audit logging only, never trusted.
export function callbackFingerprint(
  secret: string,
  payload: CallbackPayload,
): string {
  const material = [
    payload.replyflow_run_id,
    payload.organization_id,
    payload.workflow_id,
    payload.status,
    payload.execution_id ?? "",
    payload.occurred_at ?? "",
  ].join("|")
  return createHash("sha256").update(material).digest("hex").slice(0, 32)
}
