// Model adapter seam for the agent runtime.
//
// This module defines the seam and the deterministic default. A real,
// opt-in OpenAI-compatible adapter now exists in `model-provider-openai.ts`; it
// is selected only when its configuration environment variables are present, so
// with no configuration the DEFAULT and active adapter remains this fully
// deterministic, dependency-free planner.
//
// This file itself deliberately contains no HTTP client. Adding/moving a live
// provider must stay a deliberate, reviewed change with its own timeouts,
// redaction and cost controls (see `model-provider-openai.ts` and
// `resolveAgentModelAdapter`).

import type { AgentPlan } from "./types"
import { buildPlan, validateObjective, type AgentPlanInput } from "./planner-core"

export type AgentPlanRequest = AgentPlanInput

export type AgentPlanResult =
  | { ok: true; plan: AgentPlan; modelRef: string }
  | { ok: false; reason: "unavailable" | "invalid" | "model_error"; message: string }

export type AgentModelAdapter = {
  // A stable identifier recorded with the plan. "deterministic" means no LLM.
  readonly ref: string
  readonly isDeterministic: boolean
  plan(request: AgentPlanRequest): Promise<AgentPlanResult>
}

/**
 * The default adapter. Always available, never makes an external call, and
 * always returns the same plan for the same objective. This is what runs in
 * production today.
 */
export function createDeterministicModelAdapter(): AgentModelAdapter {
  return {
    ref: "deterministic-planner-v1",
    isDeterministic: true,
    async plan(request) {
      const validation = validateObjective(request.objective)
      if (!validation.ok) {
        return { ok: false, reason: "invalid", message: validation.errors.join("; ") }
      }
      return { ok: true, plan: buildPlan({ objective: validation.objective }), modelRef: "deterministic-planner-v1" }
    },
  }
}

/**
 * A deliberately unavailable adapter. Used when a caller explicitly requires an
 * LLM-backed plan: it fails honestly instead of silently falling back, so a
 * missing configuration can never be mistaken for a successful model call.
 */
export function createUnavailableModelAdapter(reason = "No language model is configured."): AgentModelAdapter {
  return {
    ref: "unconfigured",
    isDeterministic: false,
    async plan() {
      return { ok: false, reason: "unavailable", message: reason }
    },
  }
}
