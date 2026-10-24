// Pure validation for the workflow template library.
//
// Dependency-free and side-effect-free, mirroring the hand-rolled parser style
// used across the codebase (see src/lib/automation/webhook.ts and
// src/lib/leads/client-pipeline.ts). Returns discriminated unions instead of
// throwing so callers can surface errors without try/catch.
//
// Credential safety: `credentialRef` values must be REFERENCES with an explicit
// scheme prefix (`vault:` / `env:` / `integration:`). Anything that looks like a
// raw secret — a bare token, an AWS key, a bearer string — is rejected so
// templates can never embed plaintext credentials.

import { isSafeN8nWebhookPath } from "../automation/webhook"
import {
  isTemplateLifecycleStatus,
  isWorkflowStepKind,
  isWorkflowTemplateCategory,
  isWorkflowTriggerType,
  TEMPLATE_FIELD_TYPES,
} from "./types"
import type {
  ApprovalGate,
  IntegrationReference,
  TemplateField,
  TemplateIOSchema,
  WorkflowStep,
  WorkflowTemplate,
  WorkflowTriggerDefinition,
} from "./types"

export const MAX_TEMPLATE_ID_LENGTH = 80
export const MAX_STEP_ID_LENGTH = 80
export const MAX_TEMPLATE_NAME_LENGTH = 160

// Slug ids: lowercase, digits and single hyphens (aligns with existing org /
// project slug conventions).
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// Input/output field keys allow snake_case or kebab-case.
const FIELD_KEY_RE = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/
// Mirrors `integration_connections.provider` check constraint.
const PROVIDER_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/
// Reference-only credential pointer with a mandatory scheme prefix.
// Reference-only credential pointer with a mandatory scheme prefix. Uppercase
// is permitted after the scheme so `env:N8N_API_KEY` style references validate.
const CREDENTIAL_REF_RE = /^(vault|env|integration):[A-Za-z0-9][A-Za-z0-9._/-]{0,120}$/
const SYSTEM_EVENT_RE = /^[a-z0-9][a-z0-9._:-]{1,79}$/
// IANA timezone areas. We validate the AREA against known roots so fictional
// zones ("Mars/Olympus") are rejected without shipping the full tz database.
const KNOWN_TIMEZONE_AREAS = new Set([
  "UTC",
  "GMT",
  "Etc",
  "US",
  "Africa",
  "America",
  "Antarctica",
  "Arctic",
  "Asia",
  "Atlantic",
  "Australia",
  "Europe",
  "Indian",
  "Pacific",
])
const TIMEZONE_SEGMENT_RE = /^[A-Za-z0-9_+-]+$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TemplateParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function isSafeCredentialRef(value: string): boolean {
  return CREDENTIAL_REF_RE.test(value)
}

export function isSemver(value: string): boolean {
  return SEMVER_RE.test(value)
}

export function isCronExpression(value: string): boolean {
  const parts = value.trim().split(/\s+/)
  if (parts.length !== 5) return false
  return parts.every((part) => /^[0-9A-Za-z*/,\-]+$/.test(part))
}

export function isTimezone(value: string): boolean {
  if (value.length < 1 || value.length > 64) return false
  const segments = value.split("/")
  if (!KNOWN_TIMEZONE_AREAS.has(segments[0])) return false
  return segments.every((segment) => TIMEZONE_SEGMENT_RE.test(segment))
}

// ─── Primitive helpers ───────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function fail<T>(error: string): TemplateParseResult<T> {
  return { ok: false, error }
}

// ─── Field / schema validation ───────────────────────────────────────────────

function validateField(
  value: unknown,
  path: string,
): TemplateParseResult<TemplateField> {
  if (!isRecord(value)) return fail(`${path} must be an object.`)
  if (!nonEmptyString(value.key) || !FIELD_KEY_RE.test(value.key.trim())) {
    return fail(`${path}.key must be a lowercase slug (snake_case or kebab-case).`)
  }
  if (!nonEmptyString(value.label)) return fail(`${path}.label is required.`)
  if (
    !nonEmptyString(value.type) ||
    !(TEMPLATE_FIELD_TYPES as readonly string[]).includes(value.type)
  ) {
    return fail(`${path}.type is invalid.`)
  }
  if (typeof value.required !== "boolean") {
    return fail(`${path}.required must be a boolean.`)
  }
  if (value.type === "enum") {
    if (
      !Array.isArray(value.enumValues) ||
      value.enumValues.length === 0 ||
      !value.enumValues.every((item) => nonEmptyString(item))
    ) {
      return fail(`${path}.enumValues is required for enum fields.`)
    }
  }
  return {
    ok: true,
    value: {
      key: value.key.trim(),
      label: value.label.trim(),
      type: value.type as TemplateField["type"],
      required: value.required,
      description: nonEmptyString(value.description) ? value.description.trim() : undefined,
      enumValues: Array.isArray(value.enumValues)
        ? (value.enumValues as string[]).map((item) => item.trim())
        : undefined,
    },
  }
}

function validateIoSchema(
  value: unknown,
  path: string,
): TemplateParseResult<TemplateIOSchema> {
  if (!isRecord(value) || !Array.isArray(value.fields)) {
    return fail(`${path} must be an object with a fields array.`)
  }
  const fields: TemplateField[] = []
  const seen = new Set<string>()
  for (let i = 0; i < value.fields.length; i += 1) {
    const parsed = validateField(value.fields[i], `${path}.fields[${i}]`)
    if (!parsed.ok) return parsed
    if (seen.has(parsed.value.key)) {
      return fail(`${path} has duplicate field key "${parsed.value.key}".`)
    }
    seen.add(parsed.value.key)
    fields.push(parsed.value)
  }
  return { ok: true, value: { fields } }
}

// ─── Trigger validation ──────────────────────────────────────────────────────

function validateTrigger(
  value: unknown,
): TemplateParseResult<WorkflowTriggerDefinition> {
  if (!isRecord(value) || !nonEmptyString(value.type)) {
    return fail("trigger.type is required.")
  }
  if (!isWorkflowTriggerType(value.type)) {
    return fail("trigger.type must be manual, schedule, webhook or system.")
  }
  switch (value.type) {
    case "manual":
      return { ok: true, value: { type: "manual" } }
    case "schedule": {
      if (!nonEmptyString(value.cron) || !isCronExpression(value.cron)) {
        return fail("trigger.cron must be a 5-field cron expression.")
      }
      if (!nonEmptyString(value.timezone) || !isTimezone(value.timezone)) {
        return fail("trigger.timezone must be a valid IANA-style timezone.")
      }
      return { ok: true, value: { type: "schedule", cron: value.cron.trim(), timezone: value.timezone.trim() } }
    }
    case "webhook": {
      if (value.pathHint !== undefined && (!nonEmptyString(value.pathHint) || !isSafeN8nWebhookPath(value.pathHint.trim()))) {
        return fail("trigger.pathHint must be a safe relative webhook path.")
      }
      return {
        ok: true,
        value: {
          type: "webhook",
          pathHint: nonEmptyString(value.pathHint) ? value.pathHint.trim() : undefined,
        },
      }
    }
    case "system": {
      if (!nonEmptyString(value.event) || !SYSTEM_EVENT_RE.test(value.event.trim())) {
        return fail("trigger.event must be a system event name.")
      }
      return { ok: true, value: { type: "system", event: value.event.trim() } }
    }
  }
}

// ─── Integration validation ──────────────────────────────────────────────────

export function validateIntegrationReference(
  value: unknown,
  path: string,
): TemplateParseResult<IntegrationReference> {
  if (!isRecord(value)) return fail(`${path} must be an object.`)
  if (!nonEmptyString(value.provider) || !PROVIDER_RE.test(value.provider.trim())) {
    return fail(`${path}.provider must match the integration provider format.`)
  }
  if (
    !nonEmptyString(value.credentialRef) ||
    !isSafeCredentialRef(value.credentialRef.trim())
  ) {
    return fail(
      `${path}.credentialRef must be a reference (vault:/env:/integration:), never a raw secret.`,
    )
  }
  if (value.optional !== undefined && typeof value.optional !== "boolean") {
    return fail(`${path}.optional must be a boolean when provided.`)
  }
  return {
    ok: true,
    value: {
      provider: value.provider.trim(),
      credentialRef: value.credentialRef.trim(),
      optional: value.optional === true,
    },
  }
}

// ─── Step / gate validation ──────────────────────────────────────────────────

function validateStep(value: unknown, path: string): TemplateParseResult<WorkflowStep> {
  if (!isRecord(value)) return fail(`${path} must be an object.`)
  if (!nonEmptyString(value.id) || value.id.trim().length > MAX_STEP_ID_LENGTH || !SLUG_RE.test(value.id.trim())) {
    return fail(`${path}.id must be a lowercase slug (max ${MAX_STEP_ID_LENGTH}).`)
  }
  if (!nonEmptyString(value.name)) return fail(`${path}.name is required.`)
  if (!nonEmptyString(value.kind) || !isWorkflowStepKind(value.kind)) {
    return fail(`${path}.kind is invalid.`)
  }
  let integration: IntegrationReference | undefined
  if (value.integration !== undefined) {
    const parsed = validateIntegrationReference(value.integration, `${path}.integration`)
    if (!parsed.ok) return parsed
    integration = parsed.value
  }
  if (value.requiresApproval !== undefined && typeof value.requiresApproval !== "boolean") {
    return fail(`${path}.requiresApproval must be a boolean when provided.`)
  }
  if (value.approvalRole !== undefined && value.approvalRole !== "owner" && value.approvalRole !== "admin") {
    return fail(`${path}.approvalRole must be owner or admin when provided.`)
  }
  return {
    ok: true,
    value: {
      id: value.id.trim(),
      kind: value.kind,
      name: value.name.trim(),
      description: nonEmptyString(value.description) ? value.description.trim() : undefined,
      integration,
      requiresApproval: value.requiresApproval === true ? true : undefined,
      approvalRole:
        value.approvalRole === "owner" || value.approvalRole === "admin"
          ? value.approvalRole
          : undefined,
    },
  }
}

function validateApprovalGate(value: unknown, path: string): TemplateParseResult<ApprovalGate> {
  if (!isRecord(value)) return fail(`${path} must be an object.`)
  if (!nonEmptyString(value.id) || !SLUG_RE.test(value.id.trim())) {
    return fail(`${path}.id must be a lowercase slug.`)
  }
  if (!nonEmptyString(value.stepId)) return fail(`${path}.stepId is required.`)
  if (value.role !== "owner" && value.role !== "admin") {
    return fail(`${path}.role must be owner or admin.`)
  }
  if (!nonEmptyString(value.reason)) return fail(`${path}.reason is required.`)
  return {
    ok: true,
    value: {
      id: value.id.trim(),
      stepId: value.stepId.trim(),
      role: value.role,
      reason: value.reason.trim(),
    },
  }
}

// ─── Template validation ─────────────────────────────────────────────────────

/**
 * Validate an untrusted candidate into a `WorkflowTemplate`. Enforces the
 * structural rules AND cross-field invariants (unique step ids, gates that
 * reference real steps, unique integration providers). Returns a discriminated
 * union; it never throws.
 */
export function validateWorkflowTemplate(
  candidate: unknown,
): TemplateParseResult<WorkflowTemplate> {
  if (!isRecord(candidate)) return fail("Template must be an object.")

  if (!nonEmptyString(candidate.id) || candidate.id.trim().length > MAX_TEMPLATE_ID_LENGTH || !SLUG_RE.test(candidate.id.trim())) {
    return fail(`id must be a lowercase slug (max ${MAX_TEMPLATE_ID_LENGTH}).`)
  }
  if (!nonEmptyString(candidate.name) || candidate.name.trim().length > MAX_TEMPLATE_NAME_LENGTH) {
    return fail(`name must be 1-${MAX_TEMPLATE_NAME_LENGTH} characters.`)
  }
  if (!nonEmptyString(candidate.category) || !isWorkflowTemplateCategory(candidate.category)) {
    return fail("category is invalid.")
  }
  if (!nonEmptyString(candidate.summary)) return fail("summary is required.")
  if (!nonEmptyString(candidate.version) || !isSemver(candidate.version.trim())) {
    return fail("version must be a semantic version (e.g. 1.0.0).")
  }
  if (!nonEmptyString(candidate.status) || !isTemplateLifecycleStatus(candidate.status)) {
    return fail("status is invalid.")
  }

  const trigger = validateTrigger(candidate.trigger)
  if (!trigger.ok) return trigger

  const inputSchema = validateIoSchema(candidate.inputSchema, "inputSchema")
  if (!inputSchema.ok) return inputSchema
  const outputSchema = validateIoSchema(candidate.outputSchema, "outputSchema")
  if (!outputSchema.ok) return outputSchema

  if (!Array.isArray(candidate.steps) || candidate.steps.length === 0) {
    return fail("steps must be a non-empty array.")
  }
  const steps: WorkflowStep[] = []
  const stepIds = new Set<string>()
  for (let i = 0; i < candidate.steps.length; i += 1) {
    const parsed = validateStep(candidate.steps[i], `steps[${i}]`)
    if (!parsed.ok) return parsed
    if (stepIds.has(parsed.value.id)) {
      return fail(`steps has duplicate id "${parsed.value.id}".`)
    }
    stepIds.add(parsed.value.id)
    steps.push(parsed.value)
  }

  if (!Array.isArray(candidate.requiredIntegrations)) {
    return fail("requiredIntegrations must be an array.")
  }
  const requiredIntegrations: IntegrationReference[] = []
  const providers = new Set<string>()
  for (let i = 0; i < candidate.requiredIntegrations.length; i += 1) {
    const parsed = validateIntegrationReference(
      candidate.requiredIntegrations[i],
      `requiredIntegrations[${i}]`,
    )
    if (!parsed.ok) return parsed
    if (providers.has(parsed.value.provider)) {
      return fail(`requiredIntegrations has duplicate provider "${parsed.value.provider}".`)
    }
    providers.add(parsed.value.provider)
    requiredIntegrations.push(parsed.value)
  }

  if (!Array.isArray(candidate.approvalGates)) {
    return fail("approvalGates must be an array.")
  }
  const approvalGates: ApprovalGate[] = []
  const gateIds = new Set<string>()
  for (let i = 0; i < candidate.approvalGates.length; i += 1) {
    const parsed = validateApprovalGate(candidate.approvalGates[i], `approvalGates[${i}]`)
    if (!parsed.ok) return parsed
    if (gateIds.has(parsed.value.id)) {
      return fail(`approvalGates has duplicate id "${parsed.value.id}".`)
    }
    if (!stepIds.has(parsed.value.stepId)) {
      return fail(`approvalGates[${i}].stepId "${parsed.value.stepId}" does not match any step.`)
    }
    gateIds.add(parsed.value.id)
    approvalGates.push(parsed.value)
  }

  if (!isRecord(candidate.n8n) || typeof candidate.n8n.requiresMapping !== "boolean") {
    return fail("n8n.requiresMapping must be a boolean.")
  }
  if (
    candidate.n8n.pathHint !== undefined &&
    (!nonEmptyString(candidate.n8n.pathHint) || !isSafeN8nWebhookPath(candidate.n8n.pathHint.trim()))
  ) {
    return fail("n8n.pathHint must be a safe relative webhook path.")
  }

  let aiAgent: WorkflowTemplate["aiAgent"]
  if (candidate.aiAgent !== undefined) {
    if (
      !isRecord(candidate.aiAgent) ||
      !nonEmptyString(candidate.aiAgent.role) ||
      typeof candidate.aiAgent.requiresHumanApproval !== "boolean"
    ) {
      return fail("aiAgent.role and aiAgent.requiresHumanApproval are required.")
    }
    aiAgent = {
      role: candidate.aiAgent.role.trim(),
      requiresHumanApproval: candidate.aiAgent.requiresHumanApproval,
      model: nonEmptyString(candidate.aiAgent.model) ? candidate.aiAgent.model.trim() : undefined,
    }
  }

  return {
    ok: true,
    value: {
      id: candidate.id.trim(),
      name: candidate.name.trim(),
      category: candidate.category,
      summary: candidate.summary.trim(),
      version: candidate.version.trim(),
      status: candidate.status,
      trigger: trigger.value,
      inputSchema: inputSchema.value,
      outputSchema: outputSchema.value,
      steps,
      requiredIntegrations,
      approvalGates,
      n8n: {
        requiresMapping: candidate.n8n.requiresMapping,
        pathHint: nonEmptyString(candidate.n8n.pathHint) ? candidate.n8n.pathHint.trim() : undefined,
      },
      aiAgent,
    },
  }
}

/**
 * Validate a full catalog: every template must be valid AND template ids must be
 * unique. Used to catch accidental duplicate registrations at build/test time.
 */
export function validateTemplateCatalog(
  templates: readonly unknown[],
): TemplateParseResult<readonly WorkflowTemplate[]> {
  if (!Array.isArray(templates)) return fail("Catalog must be an array.")
  const values: WorkflowTemplate[] = []
  const ids = new Set<string>()
  for (let i = 0; i < templates.length; i += 1) {
    const parsed = validateWorkflowTemplate(templates[i])
    if (!parsed.ok) return fail(`catalog[${i}]: ${parsed.error}`)
    if (ids.has(parsed.value.id)) {
      return fail(`catalog has duplicate template id "${parsed.value.id}".`)
    }
    ids.add(parsed.value.id)
    values.push(parsed.value)
  }
  return { ok: true, value: values }
}

// Re-exported for callers that only need the primitive check.
export { EMAIL_RE }
