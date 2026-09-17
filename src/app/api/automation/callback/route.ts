import { NextResponse } from "next/server"

import { rateLimit } from "@/lib/security/rate-limit"
import { logError, logEvent } from "@/lib/telemetry/logging"
import {
  parseCallbackPayload,
  verifyCallbackSignature,
} from "@/lib/automation/callback-core"
import { applyCallbackResult } from "@/lib/automation/callback-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CALLBACK_RATE_LIMIT = 60
const CALLBACK_RATE_WINDOW_MS = 60_000

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

/**
 * n8n callback endpoint.
 *
 * Receives the final outcome of a workflow execution from the configured n8n
 * instance and durably updates the authoritative `workflow_runs` record.
 *
 * Authentication: the request body must be signed with HMAC-SHA256 using the
 * shared REPLYFLOW_CALLBACK_SECRET; the signature is delivered in the
 * `x-replyflow-signature` header. This prevents an attacker from forging or
 * replaying a run result.
 *
 * Idempotency: applying a terminal outcome to an already-terminal run is a
 * no-op, so a duplicate callback delivery cannot cause duplicate side effects
 * or an illegal state transition.
 */
async function handleCallback(request: Request) {
  const ip = clientIp(request)

  const limit = rateLimit(`callback:${ip}`, {
    limit: CALLBACK_RATE_LIMIT,
    windowMs: CALLBACK_RATE_WINDOW_MS,
  })

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit.limit),
    "X-RateLimit-Remaining": String(limit.remaining),
  }

  if (!limit.allowed) {
    headers["Retry-After"] = String(limit.retryAfterSeconds)
    logEvent("warn", "automation.callback", "Callback rate limit exceeded", { ip })
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers },
    )
  }

  const secret = process.env.REPLYFLOW_CALLBACK_SECRET
  if (!secret) {
    logError("automation.callback", "Callback secret is not configured.", undefined, {
      ip,
    })
    return NextResponse.json(
      { error: "Service is not configured." },
      { status: 503, headers },
    )
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers })
  }

  const signature = request.headers.get("x-replyflow-signature")
  if (!verifyCallbackSignature(secret, rawBody, signature)) {
    logEvent("warn", "automation.callback", "Invalid callback signature", { ip })
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400, headers })
  }

  const validation = parseCallbackPayload(parsed)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400, headers })
  }

  try {
    const result = await applyCallbackResult(validation.payload)

    switch (result.outcome) {
      case "applied":
        return NextResponse.json(
          { ok: true, run_id: result.runId, status: result.status },
          { status: 200, headers },
        )
      case "already_terminal":
        // Duplicate callback for an already-terminal run is harmless.
        return NextResponse.json(
          { ok: true, run_id: result.runId, status: result.status },
          { status: 200, headers },
        )
      case "not_found":
        return NextResponse.json({ error: "Not found." }, { status: 404, headers })
      case "status_mismatch":
        return NextResponse.json(
          { error: "Invalid run state." },
          { status: 409, headers },
        )
      case "forge_attempt":
        return NextResponse.json({ error: "Unauthorized." }, { status: 403, headers })
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Callback processing failed."
    logError("automation.callback", "Callback processing failed", error instanceof Error ? error : undefined, {
      run_id: validation.payload.replyflow_run_id,
      organization_id: validation.payload.organization_id,
    })
    return NextResponse.json({ error: message }, { status: 500, headers })
  }
}

export async function POST(request: Request) {
  return handleCallback(request)
}
