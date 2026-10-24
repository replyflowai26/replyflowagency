// Pure lead-capture intake + deterministic qualification engine.
//
// Dependency-free apart from node:crypto (used only to derive a stable,
// non-reversible idempotency key — the same approach callback-core uses). No
// database, network or configuration access, so it is fully unit-testable and
// safe to call before anything is persisted.
//
// This engine deliberately does NOT execute anything. It validates, normalizes
// and scores an inbound lead, then hands a normalized payload to the run
// orchestrator (src/lib/automation/lead-capture-run.ts).

import { createHash } from "node:crypto"

export const LEAD_SOURCES = ["website", "ads", "referral", "other"] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export const LEAD_TIERS = ["hot", "warm", "cold"] as const
export type LeadTier = (typeof LEAD_TIERS)[number]

export const LEAD_CAPTURE_TEMPLATE_ID = "lead-capture-qualification"
export const LEAD_CAPTURE_TEMPLATE_VERSION = "1.0.0"

// Free/consumer email providers. A business domain is a positive qualification
// signal; this list is intentionally small and explicit, not exhaustive DNS
// based detection.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_NAME = 120
const MAX_EMAIL = 254
const MAX_COMPANY = 160
const MAX_MESSAGE = 2000

export type NormalizedLead = {
  name: string
  email: string
  phone: string | null
  company: string | null
  message: string | null
  source: LeadSource
}

export type LeadQualification = {
  qualified: boolean
  score: number
  tier: LeadTier
  businessEmail: boolean
  requiresApproval: boolean
  reasons: readonly string[]
}

export type LeadCaptureParseResult =
  | { ok: true; value: NormalizedLead }
  | { ok: false; errors: readonly string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function optionalString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = collapseWhitespace(value)
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

/**
 * Normalize a phone number to a comparable form: a single optional leading "+"
 * followed by 7-15 digits. Returns null when the input is missing or not a
 * plausible phone number (so a malformed phone is dropped, not fatal).
 */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null
  const cleaned = value.trim().replace(/[\s().-]/g, "")
  if (!cleaned) return null
  const hasPlus = cleaned.startsWith("+")
  const digits = cleaned.replace(/[^0-9]/g, "")
  if (digits.length < 7 || digits.length > 15) return null
  return hasPlus ? `+${digits}` : digits
}

export function isBusinessEmail(email: string): boolean {
  const at = email.lastIndexOf("@")
  if (at <= 0) return false
  const domain = email.slice(at + 1).toLowerCase()
  return domain.length > 0 && !FREE_EMAIL_DOMAINS.has(domain)
}

/**
 * Validate and normalize a raw inbound lead. Rejects (with a list of safe,
 * user-facing errors) when required fields are missing or malformed; never
 * throws.
 */
export function parseLeadCaptureInput(raw: unknown): LeadCaptureParseResult {
  if (!isRecord(raw)) return { ok: false, errors: ["Lead payload must be a JSON object."] }

  const errors: string[] = []

  const rawName = typeof raw.name === "string" ? collapseWhitespace(raw.name) : ""
  if (rawName.length < 2 || rawName.length > MAX_NAME) {
    errors.push(`name must be between 2 and ${MAX_NAME} characters.`)
  }

  const rawEmail = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : ""
  if (rawEmail.length < 3 || rawEmail.length > MAX_EMAIL || !EMAIL_RE.test(rawEmail)) {
    errors.push("A valid email address is required.")
  }

  // A malformed phone is dropped (not fatal). An explicitly provided phone that
  // looks hostile (too long / too short) is reported so the caller knows.
  let phone: string | null = null
  if (raw.phone !== undefined && raw.phone !== null && raw.phone !== "") {
    phone = normalizePhone(raw.phone)
    if (phone === null) errors.push("phone must contain 7 to 15 digits.")
  }

  if (errors.length > 0) return { ok: false, errors }

  const sourceRaw = typeof raw.source === "string" ? raw.source.trim().toLowerCase() : "other"
  const source: LeadSource = (LEAD_SOURCES as readonly string[]).includes(sourceRaw)
    ? (sourceRaw as LeadSource)
    : "other"

  return {
    ok: true,
    value: {
      name: rawName,
      email: rawEmail,
      phone,
      company: optionalString(raw.company, MAX_COMPANY),
      message: optionalString(raw.message, MAX_MESSAGE),
      source,
    },
  }
}

/**
 * Deterministic qualification. The same normalized lead always yields the same
 * score, tier and reasons — there is no randomness and no external model call.
 *
 * Scoring (documented so it can be explained to a client):
 *   +40 business (non-free) email domain
 *   +20 phone provided
 *   +15 company provided
 *   +10 message at least 40 characters
 *    +5 message provided (any length)
 *   +10 source is website or referral
 *    +5 source is ads
 *
 * Tier: score >= 70 hot, >= 40 warm, otherwise cold.
 * `qualified` = tier is warm or hot. `requiresApproval` = hot, mirroring the
 * template's "owner approves outreach to high-value leads" gate.
 */
export function qualifyLead(lead: NormalizedLead): LeadQualification {
  const reasons: string[] = []
  let score = 0

  const businessEmail = isBusinessEmail(lead.email)
  if (businessEmail) {
    score += 40
    reasons.push("Business email domain (+40)")
  } else {
    reasons.push("Consumer email domain (+0)")
  }

  if (lead.phone) {
    score += 20
    reasons.push("Phone provided (+20)")
  }
  if (lead.company) {
    score += 15
    reasons.push("Company provided (+15)")
  }
  if (lead.message) {
    score += 5
    reasons.push("Message provided (+5)")
    if (lead.message.length >= 40) {
      score += 10
      reasons.push("Detailed message (+10)")
    }
  }
  if (lead.source === "website" || lead.source === "referral") {
    score += 10
    reasons.push(`High-intent source "${lead.source}" (+10)`)
  } else if (lead.source === "ads") {
    score += 5
    reasons.push("Paid source \"ads\" (+5)")
  }

  const tier: LeadTier = score >= 70 ? "hot" : score >= 40 ? "warm" : "cold"

  return {
    qualified: tier !== "cold",
    score,
    tier,
    businessEmail,
    requiresApproval: tier === "hot",
    reasons,
  }
}

/**
 * Stable, non-reversible idempotency key for a lead, derived from the normalized
 * identity (email + phone). Re-submitting the same lead produces the same key,
 * so the `(organization_id, idempotency_key)` unique index makes enqueueing
 * idempotent. The raw email/phone are never part of the key.
 */
export function leadIdempotencyKey(lead: NormalizedLead): string {
  const material = `${lead.email}|${lead.phone ?? ""}`
  const digest = createHash("sha256").update(material, "utf8").digest("hex")
  return `lead:${digest}`
}

/**
 * The normalized payload stored on the durable run (`workflow_runs.input`).
 * Kept deliberately small and free of control fields.
 */
export function buildLeadRunInput(
  lead: NormalizedLead,
  qualification: LeadQualification,
): Record<string, unknown> {
  return {
    template: LEAD_CAPTURE_TEMPLATE_ID,
    template_version: LEAD_CAPTURE_TEMPLATE_VERSION,
    lead,
    qualification: {
      qualified: qualification.qualified,
      score: qualification.score,
      tier: qualification.tier,
      business_email: qualification.businessEmail,
    },
    requires_approval: qualification.requiresApproval,
    source_channel: "webhook",
  }
}

/**
 * The run's output envelope. We do NOT claim a client record was created: no
 * client-creation service is authorized in this slice, so `client_id` and
 * `assigned_to` stay null and are resolved by later steps.
 *
 * Deliberately free of lead PII: the normalized lead (name/email/phone) is
 * persisted once, in `workflow_runs.input`, and never duplicated into the
 * output envelope or into audit events.
 */
export function leadCaptureOutput(
  lead: NormalizedLead,
  qualification: LeadQualification,
): Record<string, unknown> {
  return {
    client_id: null,
    qualified: qualification.qualified,
    score: qualification.score,
    tier: qualification.tier,
    assigned_to: null,
  }
}
