import { NextResponse } from "next/server"

import { rateLimit } from "@/lib/security/rate-limit"
import { logError, logEvent } from "@/lib/telemetry/logging"
import {
  isLeadIntakeBodyWithinLimit,
  LEAD_INTAKE_MAX_BODY_BYTES,
  LEAD_INTAKE_SECRET_ENV,
  LEAD_INTAKE_SIGNATURE_HEADER,
  leadIntakeFingerprint,
  parseContentLength,
  parseLeadIntakeEnvelope,
  verifyLeadIntakeSignature,
} from "@/lib/leads/lead-intake-core"
import { startLeadCaptureRun } from "@/lib/automation/lead-capture-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LEAD_INTAKE_RATE_LIMIT = 30
const LEAD_INTAKE_RATE_WINDOW_MS = 60_000

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

/**
 * Inbound lead intake endpoint.
 *
 * A trusted sender posts a signed envelope describing a lead and its routing
 * (organization / project / workflow). ReplyFlow validates, qualifies and
 * enqueues the lead onto the existing durable `workflow_runs` pipeline; a hot
 * lead is held for human approval rather than contacted immediately.
 *
 * Authentication: the raw body must be HMAC-SHA256 signed with the shared
 * REPLYFLOW_LEAD_INTAKE_SECRET and the signature delivered in the
 * `x-replyflow-signature` header. This prevents forged or replayed leads. When
 * the secret is not configured the endpoint refuses to operate (503) rather than
 * accept unauthenticated leads.
 *
 * Idempotency: the orchestrator derives a deterministic idempotency key from the
 * lead identity (email + phone) and the unique (organization_id,
 * idempotency_key) index rejects a resubmitted lead, so retries and duplicate
 * form submissions do not create duplicate runs.
 *
 * The request body contains lead PII and is therefore NEVER logged. Log lines
 * carry only a non-reversible fingerprint for correlation.
 */
async function handleLeadIntake(request: Request) {
  const ip = clientIp(request)

  const limit = rateLimit(`lead-intake:${ip}`, {
    limit: LEAD_INTAKE_RATE_LIMIT,
    windowMs: LEAD_INTAKE_RATE_WINDOW_MS,
  })

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit.limit),
    "X-RateLimit-Remaining": String(limit.remaining),
  }

  if (!limit.allowed) {
    headers["Retry-After"] = String(limit.retryAfterSeconds)
    logEvent("warn", "automation.lead-intake", "Lead intake rate limit exceeded", { ip })
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers },
    )
  }

  const secret = process.env[LEAD_INTAKE_SECRET_ENV]
  if (!secret) {
    logError("automation.lead-intake", "Lead intake secret is not configured.", undefined, {
      ip,
    })
    return NextResponse.json(
      { error: "Service is not configured." },
      { status: 503, headers },
    )
  }

  // Reject an oversized body before reading it, when the sender declares a
  // Content-Length. The actual length is re-checked after reading.
  const declaredLength = parseContentLength(request.headers.get("content-length"))
  if (declaredLength !== null && !isLeadIntakeBodyWithinLimit(declaredLength, 0)) {
    logEvent("warn", "automation.lead-intake", "Lead intake body too large", {
      ip,
      declared_length: declaredLength,
      max_bytes: LEAD_INTAKE_MAX_BODY_BYTES,
    })
    return NextResponse.json(
      { error: "Request body is too large." },
      { status: 413, headers },
    )
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers })
  }

  // Enforce the cap on the ACTUAL body too, so a missing/incorrect
  // Content-Length cannot be used to bypass the limit.
  if (!isLeadIntakeBodyWithinLimit(declaredLength, new TextEncoder().encode(rawBody).length)) {
    logEvent("warn", "automation.lead-intake", "Lead intake body too large", {
      ip,
      max_bytes: LEAD_INTAKE_MAX_BODY_BYTES,
    })
    return NextResponse.json(
      { error: "Request body is too large." },
      { status: 413, headers },
    )
  }

  const fingerprint = leadIntakeFingerprint(secret, rawBody)

  const signature = request.headers.get(LEAD_INTAKE_SIGNATURE_HEADER)
  if (!verifyLeadIntakeSignature(secret, rawBody, signature)) {
    logEvent("warn", "automation.lead-intake", "Invalid lead intake signature", {
      ip,
      fingerprint,
    })
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400, headers })
  }

  const envelope = parseLeadIntakeEnvelope(parsed)
  if (!envelope.ok) {
    return NextResponse.json({ error: envelope.error }, { status: 400, headers })
  }

  try {
    const result = await startLeadCaptureRun(envelope.envelope.lead, {
      organizationId: envelope.envelope.organizationId,
      projectId: envelope.envelope.projectId,
      workflowId: envelope.envelope.workflowId,
      clientId: envelope.envelope.clientId,
    })

    switch (result.outcome) {
      case "rejected":
        return NextResponse.json(
          { error: "Invalid lead.", errors: result.errors },
          { status: 400, headers },
        )
      case "duplicate":
        return NextResponse.json(
          { ok: true, run_id: result.runId, status: "duplicate" },
          { status: 200, headers },
        )
      case "awaiting_approval":
        return NextResponse.json(
          { ok: true, run_id: result.runId, status: "awaiting_approval" },
          { status: 202, headers },
        )
      case "enqueued":
        return NextResponse.json(
          { ok: true, run_id: result.runId, status: "enqueued" },
          { status: 200, headers },
        )
      case "failed":
        return NextResponse.json(
          { error: result.errorMessage, run_id: result.runId, code: result.errorCode },
          { status: 502, headers },
        )
    }
  } catch (error) {
    logError(
      "automation.lead-intake",
      "Lead intake processing failed",
      error instanceof Error ? error : undefined,
      {
        organization_id: envelope.envelope.organizationId,
        workflow_id: envelope.envelope.workflowId,
        fingerprint,
      },
    )
    return NextResponse.json(
      { error: "Lead intake processing failed." },
      { status: 500, headers },
    )
  }
}

export async function POST(request: Request) {
  return handleLeadIntake(request)
}
