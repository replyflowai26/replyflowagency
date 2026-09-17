import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8")
}

test("proxy lives at src/proxy.ts beside the app router so Next registers it", () => {
  // With the App Router at src/app, the proxy convention file MUST live at
  // src/proxy.ts. A root-level proxy.ts is silently never registered by the
  // Turbopack build (empty middleware manifest) and is skipped at runtime.
  assert.ok(
    existsSync(resolve(process.cwd(), "src/proxy.ts")),
    "expected src/proxy.ts"
  )
  assert.ok(
    !existsSync(resolve(process.cwd(), "proxy.ts")),
    "a root-level proxy.ts would shadow/disable the src/proxy.ts convention"
  )
})

test("next.config.ts applies production security headers app-wide", () => {
  const cfg = readSource("next.config.ts")
  assert.match(cfg, /X-Frame-Options/)
  assert.match(cfg, /DENY/)
  assert.match(cfg, /X-Content-Type-Options/)
  assert.match(cfg, /nosniff/)
  assert.match(cfg, /Referrer-Policy/)
  assert.match(cfg, /strict-origin-when-cross-origin/)
  assert.match(cfg, /Permissions-Policy/)
  assert.match(cfg, /async headers\(\)/)
  assert.match(cfg, /"\/:path\*"/)
  // CSP lives in the middleware layer (per-request nonce), not in next.config.
  assert.doesNotMatch(cfg, /const csp\s*=/)
  assert.doesNotMatch(cfg, /"Content-Security-Policy"/)
})

test("HSTS is only applied in production over https", () => {
  const cfg = readSource("next.config.ts")
  assert.match(cfg, /Strict-Transport-Security/)
  assert.match(cfg, /max-age=63072000; includeSubDomains; preload/)
  // Build the header list only from the production branch.
  assert.match(cfg, /isProduction\s*\?\s*\[/)
  assert.doesNotMatch(cfg, /Strict-Transport-Security[\s\S]{0,200}?import|node_modules/)
})

test("CSP is applied per-request in the proxy with a nonce, never in next.config", () => {
  const cfg = readSource("next.config.ts")
  assert.doesNotMatch(cfg, /"Content-Security-Policy"/)
  assert.doesNotMatch(cfg, /script-src/)
  const proxySrc = readSource("src/proxy.ts")
  assert.match(proxySrc, /buildContentSecurityPolicy/)
  assert.match(proxySrc, /createCspNonce/)
  assert.match(proxySrc, /x-nonce/)
  assert.match(proxySrc, /Content-Security-Policy/)
  assert.match(proxySrc, /NEXT_PUBLIC_SUPABASE_URL/)
  // Policies only ever allow explicit http(s) host sources.
  assert.match(proxySrc, /\.filter\(/)
  // Middleware still delegates to the Supabase session refresh flow.
  assert.match(proxySrc, /updateSession\(request/)
  assert.match(proxySrc, /matcher:/)
})

test("root layout forces dynamic rendering so the nonce is applied per request", () => {
  const layout = readSource("src/app/layout.tsx")
  assert.match(layout, /dynamic\s*=\s*"force-dynamic"/)
})

test("CSP source is safe, strict, and blocks unsafe-eval and unrestricted sources", () => {
  const cspSrc = readSource("src/lib/security/csp.ts")
  assert.match(cspSrc, /'nonce-\$\{nonce\}'/)
  assert.match(cspSrc, /'strict-dynamic'/)
  assert.match(cspSrc, /style-src 'self' 'unsafe-inline'/)
  assert.match(cspSrc, /object-src 'none'/)
  assert.match(cspSrc, /base-uri 'self'/)
  assert.match(cspSrc, /frame-ancestors 'none'/)
  assert.match(cspSrc, /form-action 'self'/)
  assert.match(cspSrc, /upgrade-insecure-requests/)
  // Never allow eval or broad remote sources.
  assert.doesNotMatch(cspSrc, /unsafe-eval/)
  assert.doesNotMatch(cspSrc, /script-src \*|default-src \*|connect-src \*/)
  // 'unsafe-inline' is only present on style-src, never on script-src.
  const scriptSrcLine = cspSrc.match(/script-src[^\r\n"`]+/)?.[0] ?? ""
  assert.match(scriptSrcLine, /'self'/)
  assert.doesNotMatch(scriptSrcLine, /unsafe-inline/)
// connect-src additions are validated: only http(s) host origins survive.
    assert.match(cspSrc, /isAllowedConnectSource/)
})

test("recovery route applies IP-based rate limiting and returns 429 with Retry-After", () => {
  const route = readSource("src/app/api/internal/automation/recovery/route.ts")
  assert.match(route, /rateLimit\(/)
  assert.match(route, /x-forwarded-for/)
  assert.match(route, /RECOVERY_RATE_LIMIT/)
  assert.match(route, /RECOVERY_RATE_WINDOW_MS/)
  assert.match(route, /\{ status: 429/)
  assert.match(route, /Retry-After/)
  assert.match(route, /X-RateLimit-Limit/)
  assert.match(route, /X-RateLimit-Remaining/)
  // Authorization must still be enforced for allowed requests.
  assert.match(route, /isAuthorized\(request\)/)
})

test("rate limiting never bypasses authorization or alters success responses", () => {
  const route = readSource("src/app/api/internal/automation/recovery/route.ts")
  // 429 path returns before any recovery work; unauthorized still 401.
  assert.match(route, /if \(!limit\.allowed\)/)
  assert.match(route, /if \(!isAuthorized\(request\)\)/)
  // Rate-limit headers are attached to every response branch.
  const rateLimitHeaderCount = route.match(/rateLimitHeaders/g)?.length ?? 0
  assert.ok(rateLimitHeaderCount >= 4, "rate limit headers should be reused across responses")
})

test("rate-limit utility implements a bounded sliding window and fail-open safety", () => {
  const src = readSource("src/lib/security/rate-limit.ts")
  assert.match(src, /import "server-only"/)
  // Sliding window: timestamps pruned by `windowMs` cutoff.
  assert.match(src, /timestamps\.filter\(\(ts\) => ts > cutoff\)/)
  assert.match(src, /timestamps\.filter\(\(ts\) => ts > oldestAllowed\)/)
  // Enforce limit and compute remaining.
  assert.match(src, />= safeLimit/)
  assert.match(src, /remaining/)
  // Never throws into the caller; fails open on internal error.
  assert.match(src, /catch \{/)
  assert.match(src, /allowed: true/)
  // Memory-bounded bucket pruning.
  assert.match(src, /sweepBuckets\(\)/)
  assert.match(src, /60_000/)
})

test("rate-limit window pruning and global sweep are present", () => {
  const src = readSource("src/lib/security/rate-limit.ts")
  assert.match(src, /sweepWindow\(window\)/)
  assert.match(src, /lastGlobalSweep/)
  assert.match(src, /if \(window\.timestamps\.length === 0\)/)
  assert.match(src, /rateLimitBuckets\.delete\(key\)/)
})

test("public contact action is IP rate limited before writing to the database", () => {
  const src = readSource("src/app/contact/actions.ts")
  assert.match(src, /rateLimit\(/)
  assert.match(src, /x-forwarded-for/)
  assert.match(src, /x-real-ip/)
  assert.match(src, /CONTACT_RATE_LIMIT/)
  assert.match(src, /if \(!limit\.allowed\)/)
  // The limiter must run before the insert, and the insert must remain org-public safe.
  assert.ok(src.indexOf("rateLimit(") < src.indexOf("contact_leads"))
  assert.match(src, /source: "website"/)
})
