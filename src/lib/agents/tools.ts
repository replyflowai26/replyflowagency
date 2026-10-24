// Allowlisted internal tools for the agent runtime.
//
// This module is the single source of truth for which tools exist and how they
// are classified. It is pure and dependency-free.
//
// Security model:
// - An agent may only invoke a tool whose id appears in this registry.
// - `internal.*` tools are deterministic, in-process transformations. They have
//   no network access and no external side effects.
// - `external.*` and `production.*` tools are CONSEQUENTIAL. They are declared
//   here so a plan can name them and the approval gate can recognise them, but
//   they are NEVER executed by the internal tool executor. A consequential step
//   is routed to an injected ExternalActionAdapter (see
//   `external-action-adapter.ts`) and only after a human approval.

export type AgentToolScope = "read" | "write-internal" | "consequential"

export type AgentToolDescriptor = {
  id: string
  scope: AgentToolScope
  consequential: boolean
  description: string
}

export const AGENT_TOOL_IDS = [
  "internal.knowledge.search",
  "internal.tasks.summarize",
  "internal.report.compose",
  "internal.content.draft",
  "internal.schedule.propose",
  "external.message.send",
  "external.payment.create",
  "production.change.apply",
] as const
export type AgentToolId = (typeof AGENT_TOOL_IDS)[number]

const REGISTRY: Record<AgentToolId, AgentToolDescriptor> = {
  "internal.knowledge.search": {
    id: "internal.knowledge.search",
    scope: "read",
    consequential: false,
    description: "Search the agent's provided knowledge scope for relevant notes.",
  },
  "internal.tasks.summarize": {
    id: "internal.tasks.summarize",
    scope: "read",
    consequential: false,
    description: "Summarise structured task data supplied as context.",
  },
  "internal.report.compose": {
    id: "internal.report.compose",
    scope: "write-internal",
    consequential: false,
    description: "Compose a human-readable report from gathered findings.",
  },
  "internal.content.draft": {
    id: "internal.content.draft",
    scope: "write-internal",
    consequential: false,
    description: "Draft outbound content for human review. Never sends it.",
  },
  "internal.schedule.propose": {
    id: "internal.schedule.propose",
    scope: "write-internal",
    consequential: false,
    description: "Propose a schedule slot. Never books it.",
  },
  "external.message.send": {
    id: "external.message.send",
    scope: "consequential",
    consequential: true,
    description: "Send an outbound message. Requires human approval.",
  },
  "external.payment.create": {
    id: "external.payment.create",
    scope: "consequential",
    consequential: true,
    description: "Create a payment. Requires human approval.",
  },
  "production.change.apply": {
    id: "production.change.apply",
    scope: "consequential",
    consequential: true,
    description: "Apply a production change. Requires human approval.",
  },
}

export function isAllowlistedTool(toolId: string): toolId is AgentToolId {
  return Object.prototype.hasOwnProperty.call(REGISTRY, toolId)
}

export function getAgentTool(toolId: string): AgentToolDescriptor | null {
  return isAllowlistedTool(toolId) ? REGISTRY[toolId] : null
}

export function isConsequentialTool(toolId: string): boolean {
  const tool = getAgentTool(toolId)
  return tool !== null && tool.consequential
}

export function listAgentTools(): readonly AgentToolDescriptor[] {
  return Object.values(REGISTRY)
}

// ─── Deterministic internal tool executor ─────────────────────────────────────
//
// Pure functions over the context supplied with a task. No I/O, no network.
// The executor refuses to run consequential tools: those are the orchestrator's
// job, gated behind approval and an injected external adapter.

export type AgentToolContext = {
  objective: string
  // Free-form knowledge notes the caller attached to the task (already
  // considered safe to read). Kept minimal.
  knowledge: readonly string[]
  data: Record<string, unknown>
}

export type AgentToolResult =
  | { ok: true; output: Record<string, unknown>; summary: string }
  | { ok: false; errorCode: string; message: string }

export type AgentToolExecutor = (
  toolId: string,
  context: AgentToolContext,
) => AgentToolResult

// Normalise a string for safe, bounded use in outputs.
function clamp(value: string, max: number): string {
  const trimmed = value.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

function searchKnowledge(context: AgentToolContext): AgentToolResult {
  const query = context.objective.toLowerCase()
  const terms = query
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)
    .slice(0, 8)

  const matches = context.knowledge
    .map((note) => {
      const lower = note.toLowerCase()
      const score = terms.reduce((acc, term) => (lower.includes(term) ? acc + 1 : acc), 0)
      return { note: clamp(note, 300), score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return {
    ok: true,
    summary: matches.length
      ? `Found ${matches.length} relevant note(s).`
      : "No relevant notes found in the provided knowledge scope.",
    output: { matches: matches.map((entry) => entry.note) },
  }
}

function summarizeTasks(context: AgentToolContext): AgentToolResult {
  const entries = Object.entries(context.data).slice(0, 25)
  return {
    ok: true,
    summary: `Summarised ${entries.length} data field(s).`,
    output: { fields: entries.map(([key, value]) => ({ key, value: clamp(String(value), 120) })) },
  }
}

function composeReport(context: AgentToolContext): AgentToolResult {
  const lines = context.knowledge.slice(0, 5).map((note) => `- ${clamp(note, 200)}`)
  const body = [`Objective: ${clamp(context.objective, 200)}`, "", "Notes:", ...(lines.length ? lines : ["- (none provided)"])].join(
    "\n",
  )
  return { ok: true, summary: "Report composed.", output: { report: body } }
}

function draftContent(context: AgentToolContext): AgentToolResult {
  const draft = `Draft regarding: ${clamp(context.objective, 160)}`
  return {
    ok: true,
    summary: "Draft prepared for human review (not sent).",
    output: { draft },
  }
}

function proposeSchedule(context: AgentToolContext): AgentToolResult {
  // Deterministic placeholder slot — never a real booking.
  return {
    ok: true,
    summary: "Proposed a single review slot (not booked).",
    output: { proposal: "next business day, 10:00 (proposal only)" },
  }
}

/**
 * The default, deterministic tool executor. Every internal tool is a pure
 * function. Consequential tools return an explicit refusal so a caller can
 * never accidentally perform an external action through this path.
 */
export function createDeterministicToolExecutor(): AgentToolExecutor {
  return (toolId, context) => {
    const tool = getAgentTool(toolId)
    if (!tool) {
      return { ok: false, errorCode: "TOOL_NOT_ALLOWLISTED", message: `Tool "${toolId}" is not allowlisted.` }
    }
    if (tool.consequential) {
      return {
        ok: false,
        errorCode: "TOOL_REQUIRES_APPROVAL",
        message: `Tool "${toolId}" is consequential and cannot be executed internally.`,
      }
    }
    switch (toolId) {
      case "internal.knowledge.search":
        return searchKnowledge(context)
      case "internal.tasks.summarize":
        return summarizeTasks(context)
      case "internal.report.compose":
        return composeReport(context)
      case "internal.content.draft":
        return draftContent(context)
      case "internal.schedule.propose":
        return proposeSchedule(context)
      default:
        return { ok: false, errorCode: "TOOL_NOT_IMPLEMENTED", message: `Tool "${toolId}" has no internal implementation.` }
    }
  }
}
