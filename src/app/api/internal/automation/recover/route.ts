import { NextResponse } from "next/server"
import { recoverStuckWorkflowRuns } from "@/lib/automation/recovery-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const authorization = request.headers.get("authorization")
  return authorization === `Bearer ${secret}`
}

async function runRecovery(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const summary = await recoverStuckWorkflowRuns()
    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error("workflow recovery failed", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workflow recovery failed." },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  return runRecovery(request)
}

export async function POST(request: Request) {
  return runRecovery(request)
}
