// Jarvis capability status — a pure, honest report of what the agent runtime
// can and cannot do in the current environment.
//
// This module exists so the Jarvis dashboard page states facts instead of
// marketing claims. It is dependency-free (aside from the existing pure
// agent modules), side-effect free, and never reads secret VALUES — only
// whether a configuration variable is present and valid.

import { listAgentTools } from "./tools"
import {
  AI_API_KEY_ENV,
  AI_BASE_URL_ENV,
  AI_MODEL_ENV,
  parseAiModelConfig,
} from "./model-provider-openai"
import { createUnconfiguredExternalActionAdapter } from "./external-action-adapter"

export const JARVIS_PLANNER_DETERMINISTIC_REF = "deterministic-planner-v1"

export type JarvisCapabilityState =
  | "available"
  | "optional-unconfigured"
  | "optional-misconfigured"
  | "not-provisioned"

export type JarvisCapability = {
  id: string
  label: string
  state: JarvisCapabilityState
  detail: string
}

export type JarvisToolSummary = {
  id: string
  scope: string
  consequential: boolean
  description: string
}

export type JarvisRuntimeSummary = {
  capabilities: readonly JarvisCapability[]
  tools: readonly JarvisToolSummary[]
  plannerRef: string
  externalActionsConfigured: boolean
}

function modelCapability(env: Record<string, string | undefined>): JarvisCapability {
  const anySet = [AI_API_KEY_ENV, AI_BASE_URL_ENV, AI_MODEL_ENV].some(
    (key) => (env[key] ?? "").trim() !== "",
  )
  if (!anySet) {
    return {
      id: "planner",
      label: "Task planning",
      state: "available",
      detail: `Deterministic planner (${JARVIS_PLANNER_DETERMINISTIC_REF}) — plans locally with no external calls.`,
    }
  }
  const parsed = parseAiModelConfig(env)
  if (!parsed.ok) {
    return {
      id: "planner",
      label: "Task planning",
      state: "optional-misconfigured",
      detail: `Language-model planning is configured but invalid (${parsed.reason}). The deterministic planner is bypassed, so planning will fail honestly until the configuration is fixed or removed.`,
    }
  }
  return {
    id: "planner",
    label: "Task planning",
    state: "available",
    detail: `Language-model planning is configured (model reference only; the key is never displayed). The deterministic planner remains the fallback seam.`,
  }
}

/**
 * Build the honest capability report for the current environment.
 * `runtimeTablesProvisioned` is supplied by the caller after a read-only probe
 * of the database; it is never guessed here.
 */
export function getJarvisRuntimeSummary(
  env: Record<string, string | undefined> = process.env,
  options: { runtimeTablesProvisioned: boolean | null },
): JarvisRuntimeSummary {
  const tools = listAgentTools().map((tool) => ({
    id: tool.id,
    scope: tool.scope,
    consequential: tool.consequential,
    description: tool.description,
  }))

  const external = createUnconfiguredExternalActionAdapter()

  const capabilities: JarvisCapability[] = [
    modelCapability(env),
    {
      id: "tools",
      label: "Allowlisted internal tools",
      state: "available",
      detail: `${tools.filter((tool) => !tool.consequential).length} deterministic tools run in-process with no network access.`,
    },
    {
      id: "approval-gate",
      label: "Human approval gate",
      state: "available",
      detail: "Consequential steps (messaging, payments, production changes) require an owner/admin approval before they can run.",
    },
    {
      id: "external-actions",
      label: "External actions (send, pay, deploy)",
      state: external.configured ? "available" : "optional-unconfigured",
      detail: external.configured
        ? "An external action adapter is wired."
        : "No external action adapter is configured. The agent can plan and request approval, but it cannot send messages, create payments, or change production.",
    },
    {
      id: "runtime-tables",
      label: "Persistent task & memory tables",
      state:
        options.runtimeTablesProvisioned === null
          ? "not-provisioned"
          : options.runtimeTablesProvisioned
            ? "available"
            : "not-provisioned",
      detail:
        options.runtimeTablesProvisioned === null
          ? "Runtime tables could not be checked in this environment."
          : options.runtimeTablesProvisioned
            ? "Agent task, event and memory tables are present in this environment."
            : "The agent runtime migration is not applied in this environment. Tasks cannot be persisted yet; planning and capability reporting still work.",
    },
    {
      id: "autonomy",
      label: "Autonomous execution",
      state: "optional-unconfigured",
      detail:
        "Jarvis never acts on its own. Every task is started by a workspace member, and every consequential step waits for human approval.",
    },
  ]

  return {
    capabilities,
    tools,
    plannerRef: JARVIS_PLANNER_DETERMINISTIC_REF,
    externalActionsConfigured: external.configured,
  }
}
