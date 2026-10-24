// ReplyFlow AI — company-agent architecture core types.
//
// This module defines the SHAPE of the Jarvis / AI-worker system and is
// deliberately dependency-free and side-effect-free: it describes roles,
// boundaries, tasks, approvals and memory, but it never executes anything and
// never talks to a database or a model. Execution lives in
// `src/lib/agents/ops-assistant.ts` (a dependency-injected orchestrator) and
// server wiring lives in `src/lib/agents/ops-assistant-service.ts`.
//
// Design alignment with the existing platform (no parallel systems):
// - Task execution status reuses the authoritative workflow-run status machine
//   (`WorkflowRunStatus` in `src/lib/automation/run-state-machine.ts`) so the
//   agent layer speaks the same queued/running/succeeded/failed/cancelled
//   vocabulary as workflow runs. This is NOT a second queue or dispatcher.
// - The human approval gate mirrors the durable `approval_state` axis added in
//   `20261005000000_workflow_run_approval_state.sql`
//   ('none' | 'pending' | 'approved' | 'rejected').
// - Agent capabilities map onto the existing template hints
//   (`AiAgentHint`, `ApprovalGate` in `src/lib/workflows/types.ts`).
// - Tenant isolation follows `20260815000000_company_os_foundation.sql`: every
//   agent, task and memory row is owned by an `organization_id`.

import type { WorkflowRunStatus } from "../automation/run-state-machine"

// ─── Organizational roles ────────────────────────────────────────────────────
//
// The company OS is conceived as: a human CEO at the top, an AI CEO reporting
// to them, two AI chairman roles reporting to the AI CEO, AI managers reporting
// to a chairman, and AI workers reporting to a manager. Only the Operations
// Assistant worker is implemented today; the rest are declared so the data
// model and hierarchy rules do not need to change when they arrive.

export const AGENT_ROLE_KINDS = [
  "human-ceo",
  "ai-ceo",
  "ai-chairman",
  "ai-manager",
  "ai-worker",
] as const
export type AgentRoleKind = (typeof AGENT_ROLE_KINDS)[number]

// The single role that is not an AI agent. It anchors the reporting tree.
export const HUMAN_ROLE_KINDS: readonly AgentRoleKind[] = ["human-ceo"]

export function isHumanRoleKind(role: AgentRoleKind): boolean {
  return HUMAN_ROLE_KINDS.includes(role)
}

// Who a role is allowed to report to. `null` means "top of the tree".
// A human CEO reports to nobody. This encodes the hierarchy as data so it can
// be validated without a database.
const REPORTS_TO_MATRIX: Record<AgentRoleKind, readonly AgentRoleKind[] | null> = {
  "human-ceo": null,
  "ai-ceo": ["human-ceo"],
  "ai-chairman": ["ai-ceo"],
  "ai-manager": ["ai-chairman"],
  "ai-worker": ["ai-manager"],
}

export function isValidReportsTo(
  child: AgentRoleKind,
  parent: AgentRoleKind | null,
): boolean {
  const allowed = REPORTS_TO_MATRIX[child]
  if (allowed === null) return parent === null
  if (parent === null) return false
  return allowed.includes(parent)
}

export function isAgentRoleKind(value: string): value is AgentRoleKind {
  return (AGENT_ROLE_KINDS as readonly string[]).includes(value)
}

// Departments are advisory labels used to route and group agents. They are not
// a permission boundary — organization membership is.
export const AGENT_DEPARTMENTS = [
  "operations",
  "sales",
  "delivery",
  "finance",
  "support",
] as const
export type AgentDepartment = (typeof AGENT_DEPARTMENTS)[number]

export function isAgentDepartment(value: string): value is AgentDepartment {
  return (AGENT_DEPARTMENTS as readonly string[]).includes(value)
}

// ─── Agent lifecycle ─────────────────────────────────────────────────────────

export const AGENT_STATUSES = ["active", "paused", "disabled"] as const
export type AgentStatus = (typeof AGENT_STATUSES)[number]

export function isAgentStatus(value: string): value is AgentStatus {
  return (AGENT_STATUSES as readonly string[]).includes(value)
}

// An agent as persisted/described. `tools` is an allowlist of tool ids; an
// agent may never invoke a tool outside it. `modelRef` is a REFERENCE to a
// model configuration (never a secret) so a future LLM can be swapped without
// changing this shape. The default runtime is deterministic and model-free.
export type AgentDescriptor = {
  id: string
  organizationId: string
  roleKind: AgentRoleKind
  displayName: string
  department: AgentDepartment
  reportsTo: AgentRoleKind | null
  capabilities: readonly string[]
  tools: readonly string[]
  knowledgeScopes: readonly string[]
  status: AgentStatus
  modelRef: string | null
  createdAt: string
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const AGENT_TASK_CATEGORIES = [
  "research",
  "reporting",
  "data-summary",
  "outreach",
  "scheduling",
  "finance",
  "production",
  "general",
] as const
export type AgentTaskCategory = (typeof AGENT_TASK_CATEGORIES)[number]

export function isAgentTaskCategory(value: string): value is AgentTaskCategory {
  return (AGENT_TASK_CATEGORIES as readonly string[]).includes(value)
}

export const AGENT_TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const
export type AgentTaskPriority = (typeof AGENT_TASK_PRIORITIES)[number]

// Shared bound for the durable task title column (ai_agent_tasks.title).
// Defined here so the orchestrator and the Task Center UI enforce one limit.
export const AGENT_TASK_TITLE_MAX_LENGTH = 200

export function isAgentTaskPriority(value: string): value is AgentTaskPriority {
  return (AGENT_TASK_PRIORITIES as readonly string[]).includes(value)
}

// The durable human-approval axis. Mirrors the workflow_run approval_state
// column exactly. `none` = no gate; `pending` = waiting for a human;
// `approved`/`rejected` = a human resolved the gate.
export const AGENT_APPROVAL_STATES = [
  "none",
  "pending",
  "approved",
  "rejected",
] as const
export type AgentApprovalState = (typeof AGENT_APPROVAL_STATES)[number]

export function isAgentApprovalState(value: string): value is AgentApprovalState {
  return (AGENT_APPROVAL_STATES as readonly string[]).includes(value)
}

// Task execution status is exactly the workflow-run status vocabulary. We
// re-export it under an agent-specific alias for readability.
export type AgentTaskStatus = WorkflowRunStatus

export type AgentTaskEventType =
  | "agent.task.planned"
  | "agent.task.approval_required"
  | "agent.task.approval_granted"
  | "agent.task.approval_rejected"
  | "agent.task.executing"
  | "agent.task.external_action"
  | "agent.task.retry"
  | "agent.task.succeeded"
  | "agent.task.failed"
  | "agent.task.cancelled"

export type AgentTask = {
  id: string
  organizationId: string
  agentId: string
  createdByUserId: string
  title: string
  objective: string
  category: AgentTaskCategory
  priority: AgentTaskPriority
  status: AgentTaskStatus
  approvalState: AgentApprovalState
  requiresApproval: boolean
  plan: AgentPlan | null
  result: AgentTaskResult | null
  errorCode: string | null
  errorMessage: string | null
  retryCount: number
  maxRetries: number
  idempotencyKey: string | null
  lastActivityAt: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

// ─── Plans ───────────────────────────────────────────────────────────────────
//
// A plan is a pure, reviewable description of what the agent intends to do.
// Every step names an allowlisted tool. A step is `consequential` when it would
// produce an external side effect (sending a message, moving money, changing
// production); consequential steps can only run after a human approval.

export type AgentPlanStep = {
  id: string
  tool: string
  description: string
  consequential: boolean
  dependsOn: readonly string[]
}

export type AgentPlan = {
  category: AgentTaskCategory
  summary: string
  steps: readonly AgentPlanStep[]
  requiresApproval: boolean
  // True when this plan was produced deterministically (no model configured).
  deterministic: boolean
  warnings: readonly string[]
}

// ─── Results ─────────────────────────────────────────────────────────────────

export type AgentTaskResult = {
  summary: string
  // Human-readable report body. Kept PII-minimal by the tool executor.
  report: string
  // Structured, serialisable findings. Values must already be PII-minimised.
  findings: Record<string, unknown>
  stepOutcomes: readonly AgentStepOutcome[]
}

export type AgentStepOutcome = {
  stepId: string
  tool: string
  ok: boolean
  detail: string
  consequential: boolean
}

// ─── Memory ──────────────────────────────────────────────────────────────────
//
// Minimal, scoped memory. There is no vector store and no embeddings: entries
// are explicit key/value records attached to a task, an agent or the whole
// organization. Sensitive raw payloads are redacted before storage.

export const AGENT_MEMORY_SCOPES = ["task", "agent", "organization"] as const
export type AgentMemoryScope = (typeof AGENT_MEMORY_SCOPES)[number]

export function isAgentMemoryScope(value: string): value is AgentMemoryScope {
  return (AGENT_MEMORY_SCOPES as readonly string[]).includes(value)
}

export type AgentMemoryEntry = {
  organizationId: string
  agentId: string
  taskId: string | null
  scope: AgentMemoryScope
  key: string
  value: Record<string, unknown>
  createdAt: string
}

// ─── Type guards for persistence boundaries ───────────────────────────────────

export function isAgentTaskStatus(value: string): value is AgentTaskStatus {
  return (["queued", "running", "succeeded", "failed", "cancelled"] as readonly string[]).includes(
    value,
  )
}
