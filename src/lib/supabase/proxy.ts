import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseEnvironment } from "./env"

export async function updateSession(request: NextRequest, requestHeaders?: Headers) {
  const { url, publishableKey } = getSupabaseEnvironment()

  // Preserve any headers added by the caller (e.g. x-nonce + CSP hardening)
  // while the session-refresh flow re-issues the response.
  const forwardHeaders = requestHeaders ?? request.headers

  let response = NextResponse.next({ request: { headers: forwardHeaders } })

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request: { headers: forwardHeaders } })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  await supabase.auth.getClaims()

  return response
}
