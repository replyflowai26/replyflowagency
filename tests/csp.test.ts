import assert from "node:assert/strict"
import test from "node:test"
import {
  buildContentSecurityPolicy,
  createCspNonce,
} from "../src/lib/security/csp.js"

test("CSP keeps a strict nonce-based script-src with no unsafe-inline or unsafe-eval", () => {
  const nonce = createCspNonce()
  const csp = buildContentSecurityPolicy({ nonce })

  const scriptSrc = extractDirective(csp, "script-src")
  assert.ok(scriptSrc.includes(`'self'`))
  assert.ok(scriptSrc.includes(`'nonce-${nonce}'`))
  assert.ok(scriptSrc.includes("'strict-dynamic'"))
  assert.ok(!scriptSrc.includes("'unsafe-inline'"))
  assert.ok(!scriptSrc.includes("'unsafe-eval'"))
  assert.doesNotMatch(csp, /unsafe-eval/)
})

test("CSP pins every directive to self/none and blocks wildcards", () => {
  const csp = buildContentSecurityPolicy({ nonce: createCspNonce() })

  assert.ok(extractDirective(csp, "default-src").includes("'self'"))
  assert.equal(extractDirective(csp, "object-src"), "'none'")
  assert.equal(extractDirective(csp, "base-uri"), "'self'")
  assert.equal(extractDirective(csp, "form-action"), "'self'")
  assert.equal(extractDirective(csp, "frame-ancestors"), "'none'")
  assert.ok(extractDirective(csp, "img-src").includes("data:"))
  assert.ok(extractDirective(csp, "font-src").includes("data:"))
  assert.ok(csp.includes("upgrade-insecure-requests"))
  assert.doesNotMatch(csp, /\*|\?\s|data:\s+\w+\s+https?:\/\//)
  assert.doesNotMatch(csp, /connect-src \*/)
})

test("connect-src includes only self plus explicit http(s) origins", () => {
  const supabaseUrl = "https://abcdefghijklmno.supabase.co"
  const csp = buildContentSecurityPolicy({
    nonce: createCspNonce(),
    connectSources: [supabaseUrl],
  })
  const connectSrc = extractDirective(csp, "connect-src")
  assert.ok(connectSrc.includes("'self'"))
  assert.ok(connectSrc.includes(supabaseUrl))
})

test("connect-src rejects wildcards, schemes-less roots, and junk sources", () => {
  const csp = buildContentSecurityPolicy({
    nonce: createCspNonce(),
    connectSources: [
      "*",
      "",
      "  ",
      "https://",
      "http://bad",
      "https://*.supabase.co",
      "javascript:alert(1)",
      "data:",
    ],
  })
  const connectSrc = extractDirective(csp, "connect-src")
  assert.equal(connectSrc, "'self'")
  assert.doesNotMatch(csp, /\*/)
})

test("connect-src accepts the local dev stack (localhost / loopback / LAN IPv4)", () => {
  for (const source of [
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://127.0.0.1",
    "http://192.168.1.50:54321",
  ]) {
    const csp = buildContentSecurityPolicy({
      nonce: createCspNonce(),
      connectSources: [source],
    })
    assert.ok(
      extractDirective(csp, "connect-src").includes(source),
      `connect-src must allow ${source}`,
    )
  }
})

test("upgrade-insecure-requests is omitted when a connect source is plain http", () => {
  const withHttp = buildContentSecurityPolicy({
    nonce: createCspNonce(),
    connectSources: ["http://127.0.0.1:54321"],
  })
  assert.doesNotMatch(withHttp, /upgrade-insecure-requests/)

  const withHttps = buildContentSecurityPolicy({
    nonce: createCspNonce(),
    connectSources: ["https://abcdefghijklmno.supabase.co"],
  })
  assert.match(withHttps, /upgrade-insecure-requests/)
})

test("nonces are unique, unpredictable base64url strings", () => {
  const seen = new Set<string>()
  for (let i = 0; i < 1000; i++) {
    const nonce = createCspNonce()
    assert.match(nonce, /^[A-Za-z0-9_-]+$/)
    assert.ok(nonce.length >= 20)
    assert.ok(!seen.has(nonce), "nonce must never repeat")
    seen.add(nonce)
  }
})

function extractDirective(csp: string, directive: string): string {
  const match = csp.split("; ").find((part) => part.startsWith(`${directive} `))
  assert.ok(match, `directive ${directive} should be present`)
  return match.slice(directive.length + 1)
}