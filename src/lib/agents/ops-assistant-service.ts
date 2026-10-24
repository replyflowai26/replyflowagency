import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { resolveAgentModelAdapter } from "@/lib/agents/model-provider-openai"
import { createDeterministicToolExecutor } from "@/lib/agents/tools"
import { createUnconfiguredExternalActionAdapter } from "@/lib/agents/external-action-adapter"
import {
  AGENT_TASK_WRITE_ROLES,
  LEAD_APPROVAL_APPROVER_ROLES,
} from "@/lib/agents/authz"
import {
  cancelAgentTask,
  executeAgentTask,
  listAgentTasks,
  resolveAgentApproval,
  startAgentTask,
  type CancelAgentTaskOutcome,
  type ExecuteAgentTaskOutcome,
  type OpsAssistantContext,
  type OpsAssistantDeps,
  type ResolveApprovalOutcome,
  type StartAgentTaskInput,
  type StartAgentTaskOutcome,
} from "@/lib/agents/ops-assistant"
import type { AgentTask } from "@/lib/agents/types"

// Server-only wiring for the Operations Assistant.
//
// The first internal agent is addressed by a stable, well-known LOGICAL id
// ("ops-assistant") — a WORKER in the operations department. The orchestrator
// resolves that logical id to the organization's real `ai_agents` row before
// any uuid FK column is written (see `agent-identity.ts`), so this constant
// never needs to become a uuid itself.
export const OPS_ASSISTANT_AGENT_ID = "ops-assistant"
export const OPS_ASSISTANT_ROLE_KIND = "ai-worker"

// Role boundaries are defined once in the pure, unit-tested authz module.
// WRITE_ROLES: start/execute/cancel. APPROVAL_ROLES (owner/admin): resolving a
// consequential approval gate — identical to the lead-approval boundary.
const WRITE_ROLES = AGENT_TASK_WRITE_ROLES
const APPROVAL_ROLES = LEAD_APPROVAL_APPROVER_ROLES

type Membership = { organization_id: string; role: string }

async function resolveMembership(userId: string): Promise<Membership> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Membership>()

  if (error || !data) throw new Error("Workspace membership not found.")
  return data
}

function assertRole(membership: Membership, allowed: readonly string[], action: string): void {
  if (!allowed.includes(membership.role)) {
    throw new Error(`Insufficient permissions to ${action}.`)
  }
}

// The default dependency wiring. The model is selected from configuration:
// with no AI env vars the deterministic planner is used (today's default);
// with REPLYFLOW_AI_* set the real OpenAI-compatible adapter is used; with a
// partial configuration an adapter that fails honestly is used. The tool
// executor is pure, and the external-action adapter is UNCONFIGURED: the agent
// can plan and request approval for consequential steps, but cannot perform them
// until an adapter is deliberately wired here.
function defaultDeps(): OpsAssistantDeps {
  return {
    supabase: createAdminClient(),
    model: resolveAgentModelAdapter(process.env),
    tools: createDeterministicToolExecutor(),
    external: createUnconfiguredExternalActionAdapter(),
  }
}

function buildContext(membership: Membership, userId: string): OpsAssistantContext {
  return {
    organizationId: membership.organization_id,
    agentId: OPS_ASSISTANT_AGENT_ID,
    createdByUserId: userId,
    // The acting human for this call. On approval paths (decideOpsApproval) the
    // session user IS the approver; recording it makes every decision auditable.
    actorUserId: userId,
  }
}

export async function startOpsTask(
  userId: string,
  input: StartAgentTaskInput,
): Promise<StartAgentTaskOutcome> {
  const membership = await resolveMembership(userId)
  assertRole(membership, WRITE_ROLES, "start an agent task")
  return startAgentTask(input, buildContext(membership, userId), defaultDeps())
}

export async function executeOpsTask(
  userId: string,
  taskId: string,
  options: { knowledge?: readonly string[]; data?: Record<string, unknown> } = {},
): Promise<ExecuteAgentTaskOutcome> {
  const membership = await resolveMembership(userId)
  assertRole(membership, WRITE_ROLES, "execute an agent task")
  return executeAgentTask(taskId, buildContext(membership, userId), defaultDeps(), options)
}

export async function decideOpsApproval(
  userId: string,
  taskId: string,
  decision: "approved" | "rejected",
): Promise<ResolveApprovalOutcome> {
  const membership = await resolveMembership(userId)
  // Resolving a human approval gate is restricted to owners/admins.
  assertRole(membership, APPROVAL_ROLES, "resolve an agent approval")
  return resolveAgentApproval(taskId, decision, buildContext(membership, userId), defaultDeps())
}

export async function cancelOpsTask(
  userId: string,
  taskId: string,
): Promise<CancelAgentTaskOutcome> {
  const membership = await resolveMembership(userId)
  assertRole(membership, WRITE_ROLES, "cancel an agent task")
  return cancelAgentTask(taskId, buildContext(membership, userId), defaultDeps())
}

// Read side for the Task Center. Any workspace member (including a viewer)
// may READ tasks — matching the `ai_agent_tasks_select_member` RLS policy —
// while WRITE_ROLES above still gates creation. The organization is always
// resolved from the caller's membership, never supplied by the browser.
export async function listOpsTasks(userId: string): Promise<readonly AgentTask[]> {
  const membership = await resolveMembership(userId)
  return listAgentTasks({ supabase: createAdminClient() }, membership.organization_id)
}
