"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import {
  approveJarvisTaskAction,
  rejectJarvisTaskAction,
  runJarvisTaskAction,
} from "./actions"
import {
  TASK_CENTER_AWAITING_APPROVER_NOTE,
  canShowApprovalControls,
  canShowRunControl,
  type TaskCenterActionState,
  type TaskPersistence,
} from "@/lib/agents/task-center"
import type { AgentApprovalState, AgentTaskStatus } from "@/lib/agents/types"

const idle: TaskCenterActionState = { status: "idle" }

const STATUS_TONE: Record<TaskCenterActionState["status"], string> = {
  idle: "",
  error: "text-rose-300",
  info: "text-amber-100",
  success: "text-emerald-300",
  blocked: "text-amber-100",
}

const BUTTON_BASE =
  "rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"

/**
 * Per-row task controls (task 54). Buttons render only when the pure
 * eligibility helpers say the action is genuinely available for this viewer
 * and task state; every submit passes only a hidden taskId. Approving also
 * runs the task (the orchestrator executes synchronously after approval), so
 * the button says so. Nothing here executes without an explicit human click,
 * and all server-side authorization/state checks are re-run on every action.
 */
export function TaskRowControls({
  taskId,
  status,
  approvalState,
  canApprove,
  canWrite,
  persistence,
}: {
  taskId: string
  status: AgentTaskStatus
  approvalState: AgentApprovalState
  canApprove: boolean
  canWrite: boolean
  persistence: TaskPersistence
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveJarvisTaskAction,
    idle,
  )
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectJarvisTaskAction,
    idle,
  )
  const [runState, runAction, runPending] = useActionState(runJarvisTaskAction, idle)
  const router = useRouter()

  const anyPending = approvePending || rejectPending || runPending

  useEffect(() => {
    if (
      approveState.status === "success" ||
      rejectState.status === "success" ||
      runState.status === "success"
    ) {
      router.refresh()
    }
  }, [approveState, rejectState, runState, router])

  const showApprove = canShowApprovalControls(
    { approvalState },
    { canApprove, persistence },
  )
  const showRun = canShowRunControl(
    { status, approvalState },
    { canWrite, persistence },
  )
  const showAwaitingNote =
    persistence === "available" && approvalState === "pending" && !canApprove

  if (!showApprove && !showRun && !showAwaitingNote) return null

  // Show the most recent outcome message across the three actions.
  const states = [approveState, rejectState, runState].filter(
    (s) => s.status !== "idle",
  )
  const latest = states.length > 0 ? states[states.length - 1] : null

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {showApprove ? (
          <>
            <form action={approveAction}>
              <input type="hidden" name="taskId" value={taskId} />
              <button
                type="submit"
                disabled={anyPending}
                className={`${BUTTON_BASE} bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/25`}
              >
                {approvePending ? "Approving…" : "Approve & run"}
              </button>
            </form>
            <form action={rejectAction}>
              <input type="hidden" name="taskId" value={taskId} />
              <button
                type="submit"
                disabled={anyPending}
                className={`${BUTTON_BASE} bg-rose-300/15 text-rose-100 hover:bg-rose-300/25`}
              >
                {rejectPending ? "Rejecting…" : "Reject"}
              </button>
            </form>
          </>
        ) : null}
        {showRun ? (
          <form action={runAction}>
            <input type="hidden" name="taskId" value={taskId} />
            <button
              type="submit"
              disabled={anyPending}
              className={`${BUTTON_BASE} bg-white/10 text-white/85 hover:bg-white/20`}
            >
              {runPending ? "Running…" : "Run task"}
            </button>
          </form>
        ) : null}
        {showAwaitingNote ? (
          <p className="text-[11px] leading-4 text-white/60">
            {TASK_CENTER_AWAITING_APPROVER_NOTE}
          </p>
        ) : null}
      </div>
      {latest && latest.message ? (
        latest.status === "success" || latest.status === "info" ? (
          <p className={`text-xs ${STATUS_TONE[latest.status]}`} role="status">
            {latest.message}
          </p>
        ) : (
          <p className={`text-xs ${STATUS_TONE[latest.status]}`} role="alert">
            {latest.message}
          </p>
        )
      ) : null}
    </div>
  )
}
