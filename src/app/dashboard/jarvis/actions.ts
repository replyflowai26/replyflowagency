"use server"

import { createClient } from "@/lib/supabase/server"
import { decideOpsApproval, executeOpsTask, startOpsTask } from "@/lib/agents/ops-assistant-service"
import {
  isPersistenceUnavailableError,
  resolveOutcomeToState,
  runOutcomeToState,
  startOutcomeToState,
  TASK_CENTER_ACTION_BLOCKED_MESSAGE,
  TASK_CENTER_APPROVE_FAILED_MESSAGE,
  TASK_CENTER_BLOCKED_MESSAGE,
  TASK_CENTER_CREATE_FAILED_MESSAGE,
  TASK_CENTER_REJECT_FAILED_MESSAGE,
  TASK_CENTER_RUN_FAILED_MESSAGE,
  type TaskCenterActionState,
} from "@/lib/agents/task-center"

type SessionClient = Awaited<ReturnType<typeof createClient>>

// Jarvis Task Center actions (tasks 53–54).
//
// Security (every action, same pattern): the caller identity comes ONLY from
// the session claims resolved inside this action. `startOpsTask`,
// `executeOpsTask` and `decideOpsApproval` independently resolve the caller's
// workspace membership and role on the server (`resolveMembership` +
// `assertRole`), and the orchestrator re-checks task state with
// compare-and-set updates. Forms supply only a task id — never a user id,
// organization id, role or outcome.

async function probeTaskPersistence(supabase: SessionClient): Promise<boolean | null> {
  try {
    const { error } = await supabase
      .from("ai_agent_tasks")
      .select("id", { count: "exact", head: true })
      .limit(1)
    if (!error) return true
    return isPersistenceUnavailableError(error) ? false : null
  } catch {
    return null
  }
}

// Shared guard for every task action: authenticate, run the service call,
// surface only our own constant messages, and classify persistence failures
// honestly. Raw error internals are never returned to the browser.
async function guardTaskAction(
  supabase: SessionClient,
  blockedMessage: string,
  failedMessage: string,
  run: (userId: string) => Promise<TaskCenterActionState>,
): Promise<TaskCenterActionState> {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) {
    return { status: "error", message: "Authentication required." }
  }
  try {
    return await run(userId)
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (
      message === "Workspace membership not found." ||
      message.startsWith("Insufficient permissions to ")
    ) {
      return { status: "error", message }
    }
    const provisioned = await probeTaskPersistence(supabase)
    if (provisioned === false) {
      return { status: "blocked", message: blockedMessage }
    }
    return { status: "error", message: failedMessage }
  }
}

export async function createJarvisTaskAction(
  _previousState: TaskCenterActionState,
  formData: FormData,
): Promise<TaskCenterActionState> {
  const title = String(formData.get("title") ?? "")
  const objective = String(formData.get("objective") ?? "")
  const priority = String(formData.get("priority") ?? "normal") as
    | "low"
    | "normal"
    | "high"
    | "urgent"

  const supabase = await createClient()
  return guardTaskAction(
    supabase,
    TASK_CENTER_BLOCKED_MESSAGE,
    TASK_CENTER_CREATE_FAILED_MESSAGE,
    async (userId) => {
      const outcome = await startOpsTask(userId, { title, objective, priority })
      return startOutcomeToState(outcome)
    },
  )
}

// Approve a pending task. Per `resolveAgentApproval`, approval also EXECUTES
// the approved plan synchronously — the outcome mapping states both facts.
export async function approveJarvisTaskAction(
  _previousState: TaskCenterActionState,
  formData: FormData,
): Promise<TaskCenterActionState> {
  const taskId = String(formData.get("taskId") ?? "")
  if (!taskId) return { status: "error", message: "Task id is missing." }
  const supabase = await createClient()
  return guardTaskAction(
    supabase,
    TASK_CENTER_ACTION_BLOCKED_MESSAGE,
    TASK_CENTER_APPROVE_FAILED_MESSAGE,
    async (userId) => {
      const outcome = await decideOpsApproval(userId, taskId, "approved")
      return resolveOutcomeToState(outcome, "approved")
    },
  )
}

// Reject a pending task. The orchestrator cancels it; nothing is executed.
export async function rejectJarvisTaskAction(
  _previousState: TaskCenterActionState,
  formData: FormData,
): Promise<TaskCenterActionState> {
  const taskId = String(formData.get("taskId") ?? "")
  if (!taskId) return { status: "error", message: "Task id is missing." }
  const supabase = await createClient()
  return guardTaskAction(
    supabase,
    TASK_CENTER_ACTION_BLOCKED_MESSAGE,
    TASK_CENTER_REJECT_FAILED_MESSAGE,
    async (userId) => {
      const outcome = await decideOpsApproval(userId, taskId, "rejected")
      return resolveOutcomeToState(outcome, "rejected")
    },
  )
}

// Explicit human-initiated run of a queued task whose approval gate (if any)
// is already satisfied. The default wiring executes internal, allowlisted,
// deterministic tools IN-PROCESS only; consequential steps fail honestly
// (unconfigured external adapter) and never contact live services.
export async function runJarvisTaskAction(
  _previousState: TaskCenterActionState,
  formData: FormData,
): Promise<TaskCenterActionState> {
  const taskId = String(formData.get("taskId") ?? "")
  if (!taskId) return { status: "error", message: "Task id is missing." }
  const supabase = await createClient()
  return guardTaskAction(
    supabase,
    TASK_CENTER_ACTION_BLOCKED_MESSAGE,
    TASK_CENTER_RUN_FAILED_MESSAGE,
    async (userId) => {
      const outcome = await executeOpsTask(userId, taskId)
      return runOutcomeToState(outcome)
    },
  )
}
