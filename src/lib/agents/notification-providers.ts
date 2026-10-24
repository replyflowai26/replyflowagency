// Notification provider contract (task 62).
//
// This module is PURE: it defines the request shape, the validation rules and
// the honest status of every channel. There is deliberately NO send function,
// no HTTP client and no credential handling here. Wiring a real email or
// WhatsApp provider is a separate, reviewed change that must satisfy every
// guarantee listed in `NOTIFICATION_REQUIRED_GUARANTEES`.
//
// Why the rules live here rather than in a provider: any future provider must
// not be able to decide by itself whether a recipient consented, whether an
// approval exists, or whether the daily limit was respected. The same bounded
// validator is therefore applied before a provider is ever called.

export const NOTIFICATION_CHANNELS = ["email", "whatsapp", "phone"] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const NOTIFICATION_KINDS = ["internal-report", "outreach"] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/**
 * A notification may be an internal report (to the workspace owner) or
 * outreach (to an external person). Outreach is always approval-gated.
 */
export const NOTIFICATION_DAILY_SEND_LIMIT = 200
export const NOTIFICATION_RECIPIENT_MAX_LENGTH = 320
export const NOTIFICATION_IDEMPOTENCY_MIN_LENGTH = 8
export const NOTIFICATION_IDEMPOTENCY_MAX_LENGTH = 128

export const NOTIFICATION_REQUIRED_GUARANTEES = [
  "an explicit human approval for outreach (and for any consequential send)",
  "recipient and tenant validation before the provider is called",
  "an idempotency key so retries can never duplicate a send",
  "an audit record per attempt with an honest delivered/failed status",
  "per-channel rate limits and a cost budget",
  "recorded consent plus honouring opt-out immediately",
] as const

export type NotificationRecipient = {
  /** Email address or E.164 phone number, depending on the channel. */
  address: string
  /** ISO timestamp when the recipient consented. Null/empty = no consent. */
  optedInAt: string | null
  /** ISO timestamp when the recipient opted out. Non-empty = do not send. */
  optedOutAt: string | null
}

export type NotificationDeliveryRequest = {
  organizationId: string
  channel: NotificationChannel
  kind: NotificationKind
  recipient: NotificationRecipient
  templateId: string
  idempotencyKey: string
  requiresApproval: boolean
  /** Sends already made today for this tenant+channel (checked before send). */
  dailySendCount: number
  estimatedCostUsd: number
  dailyCostBudgetUsd: number
}

export type NotificationValidation =
  | { ok: true }
  | { ok: false; errors: readonly string[] }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const E164_PATTERN = /^\+[1-9]\d{7,14}$/

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim() === ""
}

/**
 * Validate a future delivery request against every mandatory guarantee that can
 * be checked locally. Returns ALL problems so an operator can fix them in one
 * pass. A request that passes is still NOT sent by this module.
 */
export function validateNotificationRequest(
  request: NotificationDeliveryRequest,
): NotificationValidation {
  const errors: string[] = []

  if (isBlank(request.organizationId)) {
    errors.push("A tenant (organization) id is required.")
  }

  const address = typeof request.recipient?.address === "string" ? request.recipient.address.trim() : ""
  if (address === "") {
    errors.push("A recipient address is required.")
  } else if (address.length > NOTIFICATION_RECIPIENT_MAX_LENGTH) {
    errors.push("Recipient address is too long.")
  } else if (request.channel === "email" && !EMAIL_PATTERN.test(address)) {
    errors.push("Recipient must be a valid email address.")
  } else if (
    (request.channel === "whatsapp" || request.channel === "phone") &&
    !E164_PATTERN.test(address)
  ) {
    errors.push("Recipient must be an E.164 phone number starting with +.")
  }

  if (isBlank(request.recipient?.optedInAt)) {
    errors.push("Recipient has not opted in to this channel.")
  }
  if (!isBlank(request.recipient?.optedOutAt)) {
    errors.push("Recipient has opted out of this channel.")
  }

  if (request.kind === "outreach" && request.requiresApproval !== true) {
    errors.push("Outreach requires an explicit human approval before sending.")
  }

  if (isBlank(request.templateId)) {
    errors.push("A template id is required.")
  }

  const keyLength = typeof request.idempotencyKey === "string" ? request.idempotencyKey.trim().length : 0
  if (
    keyLength < NOTIFICATION_IDEMPOTENCY_MIN_LENGTH ||
    keyLength > NOTIFICATION_IDEMPOTENCY_MAX_LENGTH
  ) {
    errors.push(
      `Idempotency key must be ${NOTIFICATION_IDEMPOTENCY_MIN_LENGTH}–${NOTIFICATION_IDEMPOTENCY_MAX_LENGTH} characters.`,
    )
  }

  const sendCount = Number.isFinite(request.dailySendCount)
    ? Math.max(0, Math.floor(request.dailySendCount))
    : NOTIFICATION_DAILY_SEND_LIMIT
  if (sendCount >= NOTIFICATION_DAILY_SEND_LIMIT) {
    errors.push("Daily send limit reached for this channel.")
  }

  const cost = Number.isFinite(request.estimatedCostUsd) ? request.estimatedCostUsd : Number.POSITIVE_INFINITY
  const budget = Number.isFinite(request.dailyCostBudgetUsd)
    ? request.dailyCostBudgetUsd
    : Number.NEGATIVE_INFINITY
  if (cost < 0 || budget < 0) {
    errors.push("Cost values cannot be negative.")
  } else if (cost > budget) {
    errors.push("Estimated cost exceeds the daily budget.")
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

export type NotificationProviderSummary = {
  channel: NotificationChannel
  status: "not-built"
  detail: string
}

/**
 * Honest capability report. Every channel is NOT BUILT in this task: no
 * provider, no credential and no send path exist. Nothing here should ever be
 * rendered as "connected" or "ready to send".
 */
export function describeNotificationProviders(): readonly NotificationProviderSummary[] {
  return NOTIFICATION_CHANNELS.map((channel) => ({
    channel,
    status: "not-built",
    detail:
      "No provider is configured. Sending requires an approved, reviewed provider " +
      "implementation that satisfies every guarantee in this module.",
  }))
}
