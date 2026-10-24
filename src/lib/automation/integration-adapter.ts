// External-integration seam for the lead-capture workflow.
//
// A workflow step that talks to the outside world (CRM, messaging, helpdesk)
// goes through this narrow interface so the orchestration logic can be tested
// deterministically.
//
// Implementations:
// - createMockNotificationAdapter: records calls, performs no I/O.
// - createUnconfiguredIntegrationAdapter: fails honestly when nothing is set up.
// - createHttpCrmAdapter: a real outbound HTTP adapter for a customer-owned CRM
//   webhook. It is opt-in, explicitly configured (URL + shared secret), and is
//   NEVER selected automatically. It contacts only the configured URL.
//
// The mock and unconfigured adapters perform no I/O; the HTTP adapter performs
// no I/O until deliver() is called and must be configured with a real endpoint.

import { createHash } from "node:crypto"

import { signCallbackPayload } from "./callback-core"

export const INTEGRATION_PROVIDERS = [
  "crm",
  "messaging",
  "helpdesk",
  "calendar",
  "email",
] as const
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number]

export const INTEGRATION_OPERATIONS = ["create", "send", "notify"] as const
export type IntegrationOperation = (typeof INTEGRATION_OPERATIONS)[number]

export type IntegrationDelivery = {
  provider: IntegrationProvider
  operation: IntegrationOperation
  /** Non-secret routing reference (an email address or a client/run id). */
  reference: string
  payload: Record<string, unknown>
}

export type IntegrationDeliveryResult =
  | { ok: true; providerRef: string }
  | { ok: false; reason: "unavailable" | "rejected" | "network"; message: string }

export interface NotificationAdapter {
  deliver(delivery: IntegrationDelivery): Promise<IntegrationDeliveryResult>
}

/**
 * Deterministic in-memory adapter for tests and the local demo. It records every
 * delivery and returns a configurable result; it performs no I/O and is
 * explicitly labelled as a mock.
 */
export type MockNotificationAdapter = NotificationAdapter & {
  readonly mock: true
  readonly calls: readonly IntegrationDelivery[]
}

export function createMockNotificationAdapter(
  options: { result?: IntegrationDeliveryResult; providerRef?: string } = {},
): MockNotificationAdapter {
  const calls: IntegrationDelivery[] = []
  const result: IntegrationDeliveryResult =
    options.result ?? {
      ok: true,
      providerRef: options.providerRef ?? "mock://delivery/ok",
    }

  return {
    mock: true,
    get calls() {
      return calls
    },
    async deliver(delivery) {
      calls.push(delivery)
      return result
    },
  }
}

/**
 * An adapter for environments where no real external integration is configured.
 * It fails honestly instead of pretending a delivery happened, so a misconfigured
 * deployment surfaces an actionable run failure rather than a silent success.
 */
export function createUnconfiguredIntegrationAdapter(): NotificationAdapter {
  return {
    async deliver() {
      return {
        ok: false,
        reason: "unavailable",
        message: "No external integration adapter is configured.",
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Real HTTP CRM adapter
// ---------------------------------------------------------------------------

export const DEFAULT_CRM_TIMEOUT_MS = 5000
export const DEFAULT_CRM_MAX_RETRIES = 2
export const DEFAULT_CRM_BACKOFF_MS = 250
export const MAX_CRM_BACKOFF_MS = 2000

export type CrmAdapterConfig = {
  /** Absolute https endpoint owned/operated by the customer. Required. */
  url: string
  /** Shared secret used to HMAC-sign the request body. Required. */
  secret: string
  /** Abort a single attempt after this many ms (default 5000). */
  timeoutMs?: number
  /** Extra attempts after the first, for retryable failures (default 2). */
  maxRetries?: number
  /** Injected in tests; defaults to the global fetch. Never a live call in tests. */
  fetchFn?: typeof fetch
  /** Injected in tests to make retry backoff deterministic. */
  sleep?: (ms: number) => Promise<void>
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  )
}

/**
 * Deterministic idempotency key for a delivery. A stable hash of
 * provider+operation+reference lets the CRM deduplicate retried deliveries
 * without exposing the raw reference (which may be an email address) in a
 * header.
 */
export function buildCrmIdempotencyKey(delivery: IntegrationDelivery): string {
  const material = `${delivery.provider}:${delivery.operation}:${delivery.reference}`
  return createHash("sha256").update(material, "utf8").digest("hex")
}

// Read a provider reference from a successful response without ever surfacing
// the response body to logs. Returns null when the CRM does not return an id.
async function readProviderRef(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as unknown
    if (typeof body === "object" && body !== null) {
      const id = (body as { id?: unknown }).id
      if (typeof id === "string" && id.length > 0 && id.length <= 200) return id
    }
  } catch {
    // Non-JSON success body: fall through to the neutral fallback.
  }
  return null
}

/**
 * Build an adapter that POSTs a delivery to a customer-owned CRM webhook.
 *
 * Reliability contract:
 * - Every attempt is bounded by an AbortController timeout.
 * - 4xx responses are NOT retried (the request is wrong; retrying repeats it)
 *   and are reported as `rejected`.
 * - Network errors, timeouts and 5xx responses are retried with capped
 *   exponential backoff and, if all attempts fail, reported as `network` /
 *   `unavailable` — never as success.
 * - Every attempt carries a stable `idempotency-key`, so a retried delivery is
 *   deduplicatable by the CRM.
 * - The body is HMAC-SHA256 signed and sent as `x-replyflow-signature`.
 *
 * This adapter performs network I/O. It is only ever constructed from explicit
 * configuration; tests inject a fake `fetchFn` and never reach the network.
 */
/**
 * Validate and normalise a customer CRM webhook URL.
 *
 * Only absolute https URLs are accepted; http is allowed only for loopback
 * hosts, so a local development receiver can be exercised without ever sending
 * lead PII (name/email/phone) over plaintext to a remote host. URLs that embed
 * credentials (user:pass@host) are rejected so a secret cannot be smuggled
 * through the URL. Returns the normalised URL, or null when unacceptable.
 */
export function normalizeCrmWebhookUrl(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  const isLoopback =
    host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]"
  const allowed = url.protocol === "https:" || (url.protocol === "http:" && isLoopback)
  if (!allowed) return null
  return url.href
}

export function createHttpCrmAdapter(config: CrmAdapterConfig): NotificationAdapter {
  const timeoutMs = clamp(config.timeoutMs ?? DEFAULT_CRM_TIMEOUT_MS, 100, 60000)
  const maxRetries = clamp(config.maxRetries ?? DEFAULT_CRM_MAX_RETRIES, 0, 5)
  const doFetch = config.fetchFn ?? fetch
  const sleep = config.sleep ?? defaultSleep

  return {
    async deliver(delivery) {
      const body = JSON.stringify({
        provider: delivery.provider,
        operation: delivery.operation,
        reference: delivery.reference,
        payload: delivery.payload,
      })
      const signature = signCallbackPayload(config.secret, body)
      const idempotencyKey = buildCrmIdempotencyKey(delivery)

      let lastReason: "network" | "unavailable" = "network"
      let lastMessage = "CRM delivery failed due to a network error."

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
          const response = await doFetch(config.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-replyflow-signature": signature,
              "idempotency-key": idempotencyKey,
            },
            body,
            signal: controller.signal,
          })

          if (response.ok) {
            const providerRef = await readProviderRef(response)
            return { ok: true, providerRef: providerRef ?? idempotencyKey }
          }

          if (response.status >= 400 && response.status < 500) {
            // Not retryable. Never echo the response body.
            return {
              ok: false,
              reason: "rejected",
              message: `CRM rejected the delivery (HTTP ${response.status}).`,
            }
          }

          lastReason = "unavailable"
          lastMessage = `CRM was unavailable (HTTP ${response.status}).`
        } catch (error) {
          lastReason = "network"
          lastMessage = isAbortError(error)
            ? "CRM delivery timed out."
            : "CRM delivery failed due to a network error."
        } finally {
          clearTimeout(timer)
        }

        if (attempt < maxRetries) {
          const backoff = Math.min(
            MAX_CRM_BACKOFF_MS,
            DEFAULT_CRM_BACKOFF_MS * 2 ** attempt,
          )
          await sleep(backoff)
        }
      }

      return { ok: false, reason: lastReason, message: lastMessage }
    },
  }
}
