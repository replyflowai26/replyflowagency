import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const allowedTypes = new Set<EmailOtpType>(["email", "recovery", "invite", "email_change"])

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard"
  }

  return value
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const typeValue = requestUrl.searchParams.get("type")
  const next = safeNextPath(requestUrl.searchParams.get("next"))

  if (!tokenHash || !typeValue || !allowedTypes.has(typeValue as EmailOtpType)) {
    return NextResponse.redirect(new URL("/login?error=auth_confirmation", requestUrl.origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: typeValue as EmailOtpType,
  })

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_confirmation", requestUrl.origin))
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
