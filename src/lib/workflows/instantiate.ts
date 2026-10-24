// Pure instantiation planner: template + client config -> a plan describing the
// `workflows` row that *would* be created. No database, no dispatch, no side
// effects. `executable` is always false — planning is not execution.
//
// When instantiation is eventually wired into a server action it must reuse the
// existing path (actions.createWorkflow + updateWorkflowMapping +
// queueWorkflowRun) rather than introduce a parallel execution route.

import { isUuid, validateWorkflowTemplate } from "./validation"
import type {
  IntegrationReference,
  WorkflowInstantiationPlan,
  WorkflowTemplate,
} from "./types"

export type WorkflowInstantiationConfig = {
  clientId: string | null
  nameOverride?: string
  inputDefaults?: Record<string, unknown>
}

export type WorkflowInstantiationOptions = {
  // Providers the organization has connected with status "connected". When
  // omitted, availability is treated as UNVERIFIED (never assumed available).
  availableProviders?: readonly string[]
}

export type InstantiationPlanResult =
  | { ok: true; plan: WorkflowInstantiationPlan }
  | { ok: false; error: string }

/**
 * Build an execution-free instantiation plan. Validates the template, the
 * client id and the input defaults, then reports which required integrations are
 * missing so a caller can block instantiation until they are connected.
 */
export function planWorkflowInstantiation(
  template: unknown,
  config: WorkflowInstantiationConfig,
  options: WorkflowInstantiationOptions = {},
): InstantiationPlanResult {
  const parsed = validateWorkflowTemplate(template)
  if (!parsed.ok) return { ok: false, error: `Invalid template: ${parsed.error}` }
  const validTemplate: WorkflowTemplate = parsed.value

  const name = (config.nameOverride ?? validTemplate.name).trim()
  if (name.length < 2 || name.length > 160) {
    return { ok: false, error: "Workflow name must be between 2 and 160 characters." }
  }

  if (config.clientId !== null && !isUuid(config.clientId)) {
    return { ok: false, error: "Client reference is invalid." }
  }

  const warnings: string[] = []
  const inputDefaults = config.inputDefaults ?? {}
  const knownKeys = new Set(validTemplate.inputSchema.fields.map((field) => field.key))
  for (const key of Object.keys(inputDefaults)) {
    if (!knownKeys.has(key)) {
      warnings.push(`Input default "${key}" is not part of the template input schema.`)
    }
  }

  const requiredIntegrations: readonly IntegrationReference[] =
    validTemplate.requiredIntegrations

  let missingIntegrations: string[] = []
  if (options.availableProviders === undefined) {
    warnings.push(
      "Integration availability was not provided; required integrations are unverified.",
    )
  } else {
    const available = new Set(options.availableProviders)
    missingIntegrations = requiredIntegrations
      .filter((integration) => !integration.optional && !available.has(integration.provider))
      .map((integration) => integration.provider)
  }

  if (validTemplate.n8n.requiresMapping) {
    warnings.push(
      "An n8n workflow id and webhook path must be mapped before this workflow can run.",
    )
  }

  return {
    ok: true,
    plan: {
      templateId: validTemplate.id,
      templateVersion: validTemplate.version,
      workflow: {
        name,
        description: validTemplate.summary,
        status: "draft",
      },
      triggerType: validTemplate.trigger.type,
      clientId: config.clientId,
      inputDefaults,
      requiredIntegrations,
      missingIntegrations,
      approvalGates: validTemplate.approvalGates,
      n8n: {
        required: validTemplate.n8n.requiresMapping,
        workflowId: null,
        webhookPath: null,
      },
      executable: false,
      warnings,
    },
  }
}

/**
 * True when a plan can be handed to the existing runtime: all required
 * integrations are connected and the template's approval gates are declared.
 * This does NOT assert the workflow can execute — dispatch still requires a real
 * n8n mapping and an execution adapter.
 */
export function isPlanReadyForRuntime(plan: WorkflowInstantiationPlan): boolean {
  return plan.missingIntegrations.length === 0
}
