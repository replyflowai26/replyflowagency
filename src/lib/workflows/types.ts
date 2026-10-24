// ReplyFlow AI workflow template library — core types.
//
// This module defines the SHAPE of reusable automation templates. It is
// dependency-free and contains no execution logic: a template is a description,
// not a running workflow. Execution stays in src/lib/automation/* (queue-first
// dispatch + n8n adapter + callback reconciliation). Keeping definitions
// separate from execution is deliberate: a broken template can never change how
// runs are executed, and a template can be validated/tested without a database.
//
// Alignment with the existing schema (see supabase/migrations):
// - `WorkflowTriggerType` mirrors `workflow_runs.trigger_type`
//   ('manual' | 'schedule' | 'webhook' | 'system').
// - `IntegrationReference.provider` mirrors `integration_connections.provider`
//   (`^[a-z0-9][a-z0-9_-]{1,63}$`).
// - `IntegrationReference.credentialRef` mirrors `integration_connections.secret_ref`:
//   a REFERENCE to an external vault/env entry, never a plaintext secret.
// - Run status/execution history is owned by `src/lib/automation/run-state-machine.ts`
//   and `src/lib/dashboard/run-observability-core.ts`; templates reuse those
//   concepts and do NOT introduce a parallel status model.

export const WORKFLOW_TEMPLATE_CATEGORIES = [
  "lead-capture",
  "follow-up",
  "booking",
  "crm-sync",
  "support-routing",
  "reporting",
] as const
export type WorkflowTemplateCategory =
  (typeof WORKFLOW_TEMPLATE_CATEGORIES)[number]

export const TEMPLATE_LIFECYCLE_STATUSES = [
  "draft",
  "published",
  "deprecated",
  "archived",
] as const
export type TemplateLifecycleStatus =
  (typeof TEMPLATE_LIFECYCLE_STATUSES)[number]

export const WORKFLOW_TRIGGER_TYPES = [
  "manual",
  "schedule",
  "webhook",
  "system",
] as const
export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGER_TYPES)[number]

export const WORKFLOW_STEP_KINDS = [
  "trigger",
  "condition",
  "action",
  "integration",
  "delay",
  "approval",
  "ai-agent",
  "transform",
] as const
export type WorkflowStepKind = (typeof WORKFLOW_STEP_KINDS)[number]

export const TEMPLATE_FIELD_TYPES = [
  "string",
  "text",
  "number",
  "boolean",
  "email",
  "phone",
  "datetime",
  "enum",
  "json",
] as const
export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number]

export type TemplateField = {
  key: string
  label: string
  type: TemplateFieldType
  required: boolean
  description?: string
  enumValues?: readonly string[]
}

export type TemplateIOSchema = {
  fields: readonly TemplateField[]
}

// A structured trigger. `type` is the canonical trigger type written to
// `workflow_runs.trigger_type`; the extra fields are configuration hints that
// the (future) scheduling/dispatch layer will read. They are intentionally
// optional metadata here, never executed by this module.
export type WorkflowTriggerDefinition =
  | { type: "manual" }
  | { type: "schedule"; cron: string; timezone: string }
  | { type: "webhook"; pathHint?: string }
  | { type: "system"; event: string }

// A provider plus a credential REFERENCE. `optional` templates can be delivered
// without the integration; required ones block instantiation until connected.
export type IntegrationReference = {
  provider: string
  credentialRef: string
  optional: boolean
}

// A human-in-the-loop gate. `stepId` must reference a step in the same template.
export type ApprovalGate = {
  id: string
  stepId: string
  role: "owner" | "admin"
  reason: string
}

// Advisory only. No AI agent is invoked by this module; this documents the
// intended orchestration hook for the future agent runtime.
export type AiAgentHint = {
  role: string
  requiresHumanApproval: boolean
  model?: string
}

// n8n is the only wired execution provider today. Templates declare whether a
// mapping is required; the actual id/path are supplied at instantiation/run
// time (never baked into template code).
export type N8nMappingHint = {
  requiresMapping: boolean
  pathHint?: string
}

export type WorkflowStep = {
  id: string
  kind: WorkflowStepKind
  name: string
  description?: string
  integration?: IntegrationReference
  requiresApproval?: boolean
  approvalRole?: "owner" | "admin"
}

export type WorkflowTemplate = {
  id: string
  name: string
  category: WorkflowTemplateCategory
  summary: string
  version: string
  status: TemplateLifecycleStatus
  trigger: WorkflowTriggerDefinition
  inputSchema: TemplateIOSchema
  outputSchema: TemplateIOSchema
  steps: readonly WorkflowStep[]
  requiredIntegrations: readonly IntegrationReference[]
  approvalGates: readonly ApprovalGate[]
  n8n: N8nMappingHint
  aiAgent?: AiAgentHint
}

// Per-client configuration. `values` overrides template input defaults; it is
// validated against the template's input schema before use.
export type WorkflowClientConfig = {
  clientId: string | null
  values: Record<string, unknown>
}

// A pure, side-effect-free plan describing how a template would become a
// ReplyFlow `workflows` row. `executable` is always false here by design — this
// module plans, it does not run. Dispatch/mapping happen through the existing
// automation runtime.
export type WorkflowInstantiationPlan = {
  templateId: string
  templateVersion: string
  workflow: {
    name: string
    description: string
    status: "draft"
  }
  triggerType: WorkflowTriggerType
  clientId: string | null
  inputDefaults: Record<string, unknown>
  requiredIntegrations: readonly IntegrationReference[]
  missingIntegrations: readonly string[]
  approvalGates: readonly ApprovalGate[]
  n8n: {
    required: boolean
    workflowId: null
    webhookPath: null
  }
  executable: false
  warnings: readonly string[]
}

// ─── Type guards ─────────────────────────────────────────────────────────────

export function isWorkflowTemplateCategory(
  value: string,
): value is WorkflowTemplateCategory {
  return (WORKFLOW_TEMPLATE_CATEGORIES as readonly string[]).includes(value)
}

export function isTemplateLifecycleStatus(
  value: string,
): value is TemplateLifecycleStatus {
  return (TEMPLATE_LIFECYCLE_STATUSES as readonly string[]).includes(value)
}

export function isWorkflowTriggerType(
  value: string,
): value is WorkflowTriggerType {
  return (WORKFLOW_TRIGGER_TYPES as readonly string[]).includes(value)
}

export function isWorkflowStepKind(value: string): value is WorkflowStepKind {
  return (WORKFLOW_STEP_KINDS as readonly string[]).includes(value)
}
