// Deterministic task classifier and planner for the agent runtime.
//
// No model is consulted here. Given an objective and a small context, this
// module classifies the task into a category and produces a reviewable plan
// whose steps reference only allowlisted tools. It is pure, synchronous and
// dependency-free, which makes it fully testable and safe as the default when
// no LLM is configured.
//
// The planner is intentionally conservative: any category that could produce an
// external side effect (outreach, finance, production) yields a plan containing
// a consequential step, which forces the human approval gate.

import type { AgentPlan, AgentTaskCategory, AgentPlanStep as PlanStep } from "./types"
import { isAllowlistedTool, getAgentTool, isConsequentialTool } from "./tools"

export const AGENT_OBJECTIVE_MIN_LENGTH = 8
export const AGENT_OBJECTIVE_MAX_LENGTH = 1000

export type AgentPlanInput = {
  objective: string
}

export type AgentPlanValidation =
  | { ok: true; objective: string }
  | { ok: false; errors: readonly string[] }

export function validateObjective(objective: unknown): AgentPlanValidation {
  if (typeof objective !== "string") {
    return { ok: false, errors: ["objective must be a string"] }
  }
  const trimmed = objective.trim()
  const errors: string[] = []
  if (trimmed.length < AGENT_OBJECTIVE_MIN_LENGTH) {
    errors.push(`objective must be at least ${AGENT_OBJECTIVE_MIN_LENGTH} characters`)
  }
  if (trimmed.length > AGENT_OBJECTIVE_MAX_LENGTH) {
    errors.push(`objective must be at most ${AGENT_OBJECTIVE_MAX_LENGTH} characters`)
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, objective: trimmed }
}

// Keyword → category. Ordered: the first matching rule wins, so the more
// consequential categories are checked before the generic ones.
const CLASSIFIER_RULES: readonly { category: AgentTaskCategory; keywords: readonly string[] }[] = [
  { category: "production", keywords: ["deploy", "production", "release", "rollback", "hotfix", "incident"] },
  { category: "finance", keywords: ["invoice", "payment", "pay ", "refund", "billing", "charge", "payout"] },
  { category: "outreach", keywords: ["email", "outreach", "message", "follow up", "follow-up", "campaign", "reply to", "notify"] },
  { category: "scheduling", keywords: ["schedule", "booking", "book", "calendar", "appointment", "meeting"] },
  { category: "data-summary", keywords: ["data", "pipeline", "leads", "metrics", "numbers", "stats"] },
  { category: "reporting", keywords: ["report", "summary", "summarise", "summarize", "status update", "weekly", "digest"] },
  { category: "research", keywords: ["research", "find", "look up", "lookup", "investigate", "compare"] },
]

export function classifyObjective(objective: string): AgentTaskCategory {
  const text = objective.toLowerCase()
  for (const rule of CLASSIFIER_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      return rule.category
    }
  }
  return "general"
}

// Category → intent. Each entry names allowlisted tools only.
type StepSpec = { tool: string; description: string }

const CATEGORY_STEPS: Record<AgentTaskCategory, readonly StepSpec[]> = {
  research: [
    { tool: "internal.knowledge.search", description: "Search provided knowledge for relevant notes." },
  ],
  reporting: [
    { tool: "internal.knowledge.search", description: "Gather relevant notes for the report." },
    { tool: "internal.report.compose", description: "Compose the report." },
  ],
  "data-summary": [
    { tool: "internal.tasks.summarize", description: "Summarise the supplied data." },
    { tool: "internal.report.compose", description: "Turn the summary into a readable report." },
  ],
  scheduling: [
    { tool: "internal.schedule.propose", description: "Propose a schedule slot for review." },
  ],
  outreach: [
    { tool: "internal.content.draft", description: "Draft the message for human review." },
    { tool: "external.message.send", description: "Send the message (requires approval)." },
  ],
  finance: [
    { tool: "internal.report.compose", description: "Compose the payment instruction summary." },
    { tool: "external.payment.create", description: "Create the payment (requires approval)." },
  ],
  production: [
    { tool: "internal.report.compose", description: "Compose the change summary." },
    { tool: "production.change.apply", description: "Apply the change (requires approval)." },
  ],
  general: [
    { tool: "internal.report.compose", description: "Compose a short report on the request." },
  ],
}

/**
 * Build a deterministic plan for an objective. Throws never; invalid input is
 * reported through the returned discriminated union.
 */
export function buildPlan(input: AgentPlanInput): AgentPlan {
  const category = classifyObjective(input.objective)
  const specs = CATEGORY_STEPS[category]

  const steps: PlanStep[] = specs.map((spec, index) => ({
    id: `step-${index + 1}`,
    tool: spec.tool,
    description: spec.description,
    consequential: isConsequentialTool(spec.tool),
    dependsOn: index === 0 ? [] : [`step-${index}`],
  }))

  const warnings: string[] = []
  for (const step of steps) {
    if (!isAllowlistedTool(step.tool)) {
      // Defensive: the planner itself must never emit a non-allowlisted tool.
      warnings.push(`Step ${step.id} references a non-allowlisted tool and was dropped.`)
    } else if (getAgentTool(step.tool) === null) {
      warnings.push(`Step ${step.id} references an unknown tool.`)
    }
  }

  const requiresApproval = steps.some((step) => step.consequential)

  return {
    category,
    summary: `Plan (${category}): ${steps.length} step(s).`,
    steps,
    requiresApproval,
    deterministic: true,
    warnings,
  }
}

// Re-export for callers that build plans step-by-step.
export type { AgentPlan }
