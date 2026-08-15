import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type CallbackPayload = {
  runId?: string
  externalExecutionId?: string
  status?: "succeeded" | "failed" | "cancelled"
  output?: Record<string, unknown>
  errorCode?: string
  errorMessage?: string
}

export async function POST(request: Request) {
  const callbackSecret = process.env.N8N