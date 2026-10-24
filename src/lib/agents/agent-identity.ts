// Agent identity provisioning — FK safety between ai_agent_tasks /
// ai_agent_memory and the ai_agents registry.
//
// WHY THIS EXISTS
// ---------------
// The prepared agent-runtime migration defines:
//   - ai_agent_tasks.agent_id  uuid NOT NULL, composite FK → ai_agents(id, organization_id)
//   - ai_agent_memory.agent_id uuid NOT NULL, composite FK → ai_agents(id, organization_id)
// while the service layer addresses the first worker by its STABLE LOGICAL id
// ("ops-assistant"). A logical id must therefore never reach a uuid FK column:
// this module resolves the logical id to the organization's real `ai_agents`
// row, creating that row on first use (the migration cannot be edited to seed
// it, and identity is per-organization by design).
//
// Design contract:
// - Resolve-or-create, org-scoped, using the natural key
//   (organization_id, display_name, role_kind). The registry of logical ids is
//   in this file, so a future agent is added by declaring one descriptor — this
//   is the seed of the full `ai_agents` population step in the master backlog.
// - Honest failure: when the row cannot be read or created (tables not
//   provisioned, permissions denied), the caller receives an explicit thrown
//   Error with a stable message. Nothing is faked and no task is written.
// - No credentials: only descriptive fields are stored. `model_ref` stays null;
//   model configuration lives in the environment, never in this table.
// - Provisioning happens through the injected client (the trusted server
//   client in production), matching how memory inserts are authorised by the
//   migration comments.

import { randomUUID } from "node:crypto"

import type { AgentDepartment, AgentRoleKind } from "./types"
import { AGENT_TASK_CATEGORIES } from "./types"
import { AGENT_TOOL_IDS } from "./tools"
import type { AgentLogger, AgentTaskClient } from "./ops-assistant"

export const AGENT_IDENTITY_TABLE = "ai_agents"

export const AGENT_IDENTITY_MESSAGES = {
  unknown: (logicalId: string) => `Unknown agent identity "${logicalId}".`,
  unavailable:
    "Agent identity is unavailable: the agent runtime tables could not be read in this environment.",
  createFailed:
    "Agent identity could not be provisioned: the agent registry row was rejected.",
} as const

export type AgentIdentity = {
  /** Stable logical id used by the service layer and idempotency hashes. */
  logicalId: string
  displayName: string
  roleKind: AgentRoleKind
  department: AgentDepartment
  reportsTo: AgentRoleKind | null
  capabilities: readonly string[]
  tools: readonly string[]
  knowledgeScopes: readonly string[]
}

export type AgentIdentityContext = {
  organizationId: string
  createdByUserId: string
  /** The logical agent id from the caller's context (e.g. "ops-assistant"). */
  agentId: string
}

export type AgentIdentityDeps = {
  supabase: AgentTaskClient
  newId?: () => string
  log?: AgentLogger
}

// The known agent identities. One descriptor per future agent; adding the
// second worker/manager later is a declaration, not a new mechanism.
export const OPS_ASSISTANT_IDENTITY: AgentIdentity = {
  logicalId: "ops-assistant",
  displayName: "Operations Assistant",
  roleKind: "ai-worker",
  department: "operations",
  reportsTo: "ai-manager",
  capabilities: [...AGENT_TASK_CATEGORIES],
  tools: [...AGENT_TOOL_IDS],
  knowledgeScopes: [],
}

const AGENT_IDENTITIES: readonly AgentIdentity[] = [OPS_ASSISTANT_IDENTITY]

export function resolveAgentIdentity(logicalId: string): AgentIdentity | null {
  return AGENT_IDENTITIES.find((identity) => identity.logicalId === logicalId) ?? null
}

/**
 * Resolve the organization's `ai_agents` row for the given logical agent id,
 * creating it on first use. Returns the row id (a uuid in the real database)
 * suitable for `ai_agent_tasks.agent_id` / `ai_agent_memory.agent_id`.
 *
 * Throws (never fakes a result) when:
 * - the logical id is not in the registry,
 * - the row cannot be read (tables not provisioned in this environment),
 * - the row cannot be created (permissions/constraint rejection).
 *
 * Concurrency note: there is no natural-key unique constraint on `ai_agents`,
 * so two simultaneous first starts could create two rows for the same agent.
 * Both are valid identities (tasks reference whichever row they were created
 * with). The lookup orders by created_at and applies LIMIT 1 so that, once
 * duplicates exist, every subsequent start converges on the OLDEST row instead
 * of failing: the installed supabase client's `.maybeSingle()` raises a
 * client-side PGRST116 error when more than one row matches (verified in
 * node_modules/@supabase/postgrest-js), which would otherwise make the
 * organization permanently unable to start tasks. This is documented rather
 * than prevented by a constraint because the migration must not be changed
 * here.
 */
export async function ensureAgentIdentity(
  deps: AgentIdentityDeps,
  context: AgentIdentityContext,
): Promise<string> {
  const identity = resolveAgentIdentity(context.agentId)
  if (!identity) throw new Error(AGENT_IDENTITY_MESSAGES.unknown(context.agentId))

  const { data: existing, error: selectError } = await deps.supabase
    .from(AGENT_IDENTITY_TABLE)
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("display_name", identity.displayName)
    .eq("role_kind", identity.roleKind)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (selectError) {
    ;(deps.log ?? (() => {}))(
      "error",
      "agent.identity.resolve",
      "Unable to read the agent identity row.",
      selectError,
      { organization_id: context.organizationId, logical_id: identity.logicalId },
    )
    throw new Error(AGENT_IDENTITY_MESSAGES.unavailable)
  }

  if (existing && typeof existing.id === "string" && existing.id.length > 0) {
    return existing.id
  }

  const newId = deps.newId ?? (() => randomUUID())
  const rowId = newId()

  const { error: insertError } = await deps.supabase.from(AGENT_IDENTITY_TABLE).insert({
    id: rowId,
    organization_id: context.organizationId,
    role_kind: identity.roleKind,
    display_name: identity.displayName,
    department: identity.department,
    reports_to: identity.reportsTo,
    capabilities: [...identity.capabilities],
    tools: [...identity.tools],
    knowledge_scopes: [...identity.knowledgeScopes],
    status: "active",
    model_ref: null,
    created_by: context.createdByUserId,
  })

  if (insertError) {
    ;(deps.log ?? (() => {}))(
      "error",
      "agent.identity.create",
      "Unable to provision the agent identity row.",
      insertError,
      { organization_id: context.organizationId, logical_id: identity.logicalId },
    )
    throw new Error(AGENT_IDENTITY_MESSAGES.createFailed)
  }

  return rowId
}
