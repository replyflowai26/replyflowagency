import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"
import { buildContentSecurityPolicy, createCspNonce } from "@/lib/security/csp"

const isProduction = process.env.NODE_ENV === "production"

// Strict CSP must be applied per-request because Next.js emits inline
// bootstrap scripts (self.__next_f.push) on every production HTML response.
// A static `script-src 'self'` header (as previously set in next.config.ts)
// blocks those inline scripts and leaves every page blank. Generating a fresh
// nonce here and allowing it on script-src lets Next.js attach the matching
// nonce attribute to the scripts it renders. connect-src is pinned to 'self'
// plus the Supabase API origin so the browser Supabase client can auth.
function applyHardeningHeaders(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers)
  if (!isProduction) {
    return requestHeaders
  }
  const nonce = createCspNonce()
  const csp = buildContentSecurityPolicy({
    nonce,
    connectSources: [process.env.NEXT_PUBLIC_SUPABASE_URL].filter(
      (source): source is string => Boolean(source)
    ),
  })
  // Next.js reads the nonce from the x-nonce/CSP request headers when it
  // renders HTML and mirrors it onto inline scripts and styles.
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)
  return requestHeaders
}

export async function proxy(request: NextRequest) {
  const requestHeaders = applyHardeningHeaders(request)
  const response = await updateSession(request, requestHeaders)
  const csp = requestHeaders.get("Content-Security-Policy")
  if (csp) {
    response.headers.set("Content-Security-Policy", csp)
  }
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
