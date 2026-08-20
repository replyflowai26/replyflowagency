import { NextResponse } from "next/server"

import { recoverStaleWorkflowRuns } from "@/lib/automation/recovery-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const result = await recoverStaleWorkflowRuns()

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recovery execution failed."

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  return handleRecovery(request)
}

export async function POST(request: Request) {
  return handleRecovery(request)
}
