import { NextResponse } from "next/server"

import { recoverStaleWorkflowRuns } from "@/lib/automation/recovery-service"
import { rateLimit } from "@/lib/security/rate-limit"
import { logError, logEvent } from "@/lib/telemetry/logging"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RECOVERY_RATE_LIMIT = 20
const RECOVERY_RATE_WINDOW_MS = 60_000

function isAuthorized(request: Request) {
  const configuredSecret = process.env.INTERNAL_AUTOMATION_SECRET
  const cronSecret = process.env.CRON_SECRET

  const internalSecret = request.headers.get("x-replyflow-internal-secret")
  const authorization = request.headers.get("authorization")

  if (configuredSecret && internalSecret === configuredSecret) {
    return true
  }

  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`)
}

async function handleRecovery(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"

  const limit = rateLimit(`recovery:${ip}`, {
    limit: RECOVERY_RATE_LIMIT,
    windowMs: RECOVERY_RATE_WINDOW_MS,
  })

  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(limit.limit),
    "X-RateLimit-Remaining": String(limit.remaining),
  }

  if (!limit.allowed) {
    rateLimitHeaders["Retry-After"] = String(limit.retryAfterSeconds)
    logEvent(
      "warn",
      "automation.recovery",
      "Recovery endpoint rate limit exceeded",
      { ip },
    )
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: rateLimitHeaders },
    )
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: rateLimitHeaders },
    )
  }

  try {
    const result = await recoverStaleWorkflowRuns()

    return NextResponse.json(
      { success: true, ...result },
      { headers: rateLimitHeaders },
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recovery execution failed."

    logError(
      "automation.recovery",
      "Recovery run failed",
      error instanceof Error ? error : undefined,
      { status: 500 },
    )

    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: rateLimitHeaders },
    )
  }
}

export async function GET(request: Request) {
  return handleRecovery(request)
}

export async function POST(request: Request) {
  return handleRecovery(request)
}
