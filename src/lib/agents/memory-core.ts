// Minimal, scoped agent memory.
//
// No vector store, no embeddings. Memory is a small set of explicit key/value
// entries scoped to a task, an agent, or the whole organization. Entries are
// built ONLY from already-summarised, PII-minimal task data — this module never
// receives or stores raw inbound payloads.

import type { AgentMemoryEntry, AgentMemoryScope, AgentTask, AgentTaskResult } from "./types"

export const AGENT_MEMORY_MAX_ENTRIES_PER_TASK = 8
export const AGENT_MEMORY_MAX_VALUE_BYTES = 2048

export type AgentMemoryInput = {
  organizationId: string
  agentId: string
  task: Pick<AgentTask, "id" | "title" | "category" | "priority">
  result: AgentTaskResult
  now: string
}

function boundedValue(value: Record<string, unknown>): Record<string, unknown> {
  const serialized = JSON.stringify(value)
  if (serialized.length <= AGENT_MEMORY_MAX_VALUE_BYTES) return value
  // Store the truncated summary plus an explicit marker rather than a huge blob.
  return { truncated: true, preview: serialized.slice(0, AGENT_MEMORY_MAX_VALUE_BYTES) }
}

/**
 * Build the memory entries for a finished task. Deterministic and bounded.
 */
export function buildTaskMemory(input: AgentMemoryInput): readonly AgentMemoryEntry[] {
  const { organizationId, agentId, task, result, now } = input

  const entries: AgentMemoryEntry[] = [
    {
      organizationId,
      agentId,
      taskId: task.id,
      scope: "task",
      key: `task.${task.id}.summary`,
      value: boundedValue({
        title: task.title,
        category: task.category,
        priority: task.priority,
        summary: result.summary,
      }),
      createdAt: now,
    },
    {
      organizationId,
      agentId,
      taskId: task.id,
      scope: "agent",
      key: `agent.lastTask`,
      value: boundedValue({
        taskId: task.id,
        category: task.category,
        report: result.report.slice(0, 500),
      }),
      createdAt: now,
    },
    {
      organizationId,
      agentId,
      taskId: task.id,
      scope: "organization",
      key: `org.lastOutcome`,
      value: boundedValue({
        taskId: task.id,
        category: task.category,
        summary: result.summary,
      }),
      createdAt: now,
    },
  ]

  return entries.slice(0, AGENT_MEMORY_MAX_ENTRIES_PER_TASK)
}

export function isAgentMemoryScopeValue(value: string): value is AgentMemoryScope {
  return (["task", "agent", "organization"] as readonly string[]).includes(value)
}
