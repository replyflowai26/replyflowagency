// Pure authorization boundaries for the agent runtime.
//
// Dependency-free and I/O-free so the role rules can be unit tested without a
// session or a database. This module is the DEFINITION SITE for agent task
// roles; the server wiring (`ops-assistant-service.ts`) consumes it.
//
// Reuse, not duplication: the approver roles for an agent approval gate are
// exactly the approver roles of the existing human-approval surface for
// workflow runs (owner/admin). That single tested definition lives in
// `lead-approval-core.ts` and is re-exported here under its original name, so
// both approval surfaces can never drift apart.

import {
  isApproverRole,
  LEAD_APPROVAL_APPROVER_ROLES,
} from "../automation/lead-approval-core"

/**
 * Roles permitted to start, execute and cancel agent tasks. Starting a task is
 * an internal operation (it cannot produce an external side effect on its own —
 * consequential steps are still gated), so members may use it. A viewer may not.
 */
export const AGENT_TASK_WRITE_ROLES = ["owner", "admin", "member"] as const

// Single source of truth for consequential-approval roles (owner/admin).
export { LEAD_APPROVAL_APPROVER_ROLES }

export function canStartAgentTask(role: string | null | undefined): boolean {
  return (
    typeof role === "string" &&
    (AGENT_TASK_WRITE_ROLES as readonly string[]).includes(role)
  )
}

/**
 * Resolving an agent approval gate is owner/admin only — identical to the lead
 * approval boundary, by design (see module header).
 */
export function canResolveAgentApproval(role: string | null | undefined): boolean {
  return isApproverRole(role)
}
