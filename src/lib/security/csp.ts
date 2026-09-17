// Minimal, dependency-free Content Security Policy builder.
//
// The policy is intentionally strict and hardened:
//   - script-src allows only 'self' plus the per-request nonce applied to the
//     inline bootstrap scripts Next.js emits (self.__next_f.push etc.) and the
//     nonce'd framework chunks they bootstrap via 'strict-dynamic'. It never
//     relaxes to eval or inline script execution.
//   - connect-src is 'self' plus the explicit Supabase origin so the browser
//     Supabase client can reach the API for auth/session refresh calls.
//   - Every directive pins a capability to 'self'/'none' to shrink the
//     attack surface (no *, no external origins).
//
// This module is pure and dependency-free so it can run in the Edge/Node proxy
// runtime AND be unit tested with no mocking or network.

type CspOptions = {
  /** Unique per-request nonce. Should come from createCspNonce(). */
  nonce: string
  /**
   * Extra http(s) origins to allow for connect-src (e.g. the Supabase API
   * origin). Values that are not `https://`/`http://` hosts are ignored.
   */
  connectSources?: string[]
}

const IPV4_PATTERN = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/

function isAllowedConnectSource(source: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(source)
  } catch {
    return false
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
  const host = parsed.hostname
  // Local dev stacks (localhost / loopback or LAN IPs) live on plain http and
  // never carry a wildcard; allow them so local logins keep working.
  if (host === "localhost") return true
  if (IPV4_PATTERN.test(host)) return true
  if (host.includes(":")) {
    // IPv6 literal (URL.hostname strips the surrounding brackets).
    return host.split(":").every((part) => /^[0-9a-fA-F]{1,4}$/.test(part))
  }
  // Wildcards, scheme-less values and misshapen hosts are rejected.
  return DOMAIN_PATTERN.test(host.toLowerCase())
}

/**
 * Build the full Content-Security-Policy header value for a single request.
 * Never emits wildcard sources; caller-supplied connect sources are filtered
 * to explicit http(s) hosts only.
 */
export function buildContentSecurityPolicy(options: CspOptions): string {
  const { nonce, connectSources = [] } = options
  const allowedConnectSources = connectSources.filter(
    (source): source is string => isAllowedConnectSource(source)
  )
  const connectSrc = ["'self'", ...allowedConnectSources].join(" ")
  // `upgrade-insecure-requests` upgrades http: subrequests to https:. That
  // breaks plain-http local stacks (e.g. http://127.0.0.1:54321), so only emit
  // the directive when no connect source is itself http.
  const hasInsecureConnectSource = allowedConnectSources.some((source) =>
    source.startsWith("http://")
  )
  const header = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
  if (!hasInsecureConnectSource) {
    header.push("upgrade-insecure-requests")
  }
  return header.join("; ")
}

const NONCE_BYTE_LENGTH = 16

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Generate a fresh, unpredictable, URL-safe base64 nonce for a single request.
 * Uses Web Crypto so it works on both the Edge and Node runtimes.
 */
export function createCspNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTE_LENGTH)
  globalThis.crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}