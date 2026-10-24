"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { createJarvisTaskAction } from "./actions"
import {
  TASK_CENTER_BLOCKED_MESSAGE,
  TASK_CENTER_ROLE_MESSAGE,
  TASK_CENTER_UNVERIFIED_MESSAGE,
  type TaskCenterActionState,
} from "@/lib/agents/task-center"
import { AGENT_TASK_PRIORITIES, AGENT_TASK_TITLE_MAX_LENGTH } from "@/lib/agents/types"
import {
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_OBJECTIVE_MIN_LENGTH,
} from "@/lib/agents/planner-core"

const initialState: TaskCenterActionState = { status: "idle" }

const STATUS_TONE: Record<TaskCenterActionState["status"], string> = {
  idle: "",
  error: "text-rose-300",
  info: "text-amber-100",
  success: "text-emerald-300",
  blocked: "text-amber-100",
}

const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
}

export function TaskCenterForm({
  canCreate,
  persistence,
}: {
  canCreate: boolean
  persistence: "available" | "blocked" | "unknown"
}) {
  const [state, formAction, isPending] = useActionState(
    createJarvisTaskAction,
    initialState,
  )
  const router = useRouter()

  useEffect(() => {
    if (state.status === "success") router.refresh()
  }, [state, router])

  const disabled = isPending || !canCreate || persistence !== "available"
  const blockerNote =
    persistence === "blocked"
      ? TASK_CENTER_BLOCKED_MESSAGE
      : persistence === "unknown"
        ? TASK_CENTER_UNVERIFIED_MESSAGE
        : !canCreate
          ? TASK_CENTER_ROLE_MESSAGE
          : null

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="jarvis-task-title" className="text-xs font-medium text-white/70">
            Title
          </label>
          <input
            id="jarvis-task-title"
            name="title"
            type="text"
            required
            maxLength={AGENT_TASK_TITLE_MAX_LENGTH}
            placeholder="Weekly pipeline report"
            disabled={disabled}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/60 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="jarvis-task-priority" className="text-xs font-medium text-white/70">
            Priority
          </label>
          <select
            id="jarvis-task-priority"
            name="priority"
            defaultValue="normal"
            disabled={disabled}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {AGENT_TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority] ?? priority}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="jarvis-task-objective" className="text-xs font-medium text-white/70">
          Objective
        </label>
        <textarea
          id="jarvis-task-objective"
          name="objective"
          required
          minLength={AGENT_OBJECTIVE_MIN_LENGTH}
          maxLength={AGENT_OBJECTIVE_MAX_LENGTH}
          rows={3}
          placeholder="Summarise this week’s captured leads and flag anything needing a human decision."
          disabled={disabled}
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/60 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="text-[11px] leading-4 text-white/60">
          {AGENT_OBJECTIVE_MIN_LENGTH}–{AGENT_OBJECTIVE_MAX_LENGTH} characters. Jarvis plans with
          allowlisted tools only; consequential steps wait for owner/admin approval.
        </p>
      </div>

      {blockerNote ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm leading-5 text-amber-100">
          {blockerNote}
        </p>
      ) : null}

      {state.status !== "idle" ? (
        <div aria-live="polite">
          {state.message ? (
            state.status === "success" || state.status === "info" ? (
              <p className={`text-sm ${STATUS_TONE[state.status]}`} role="status">
                {state.message}
              </p>
            ) : (
              <p className={`text-sm ${STATUS_TONE[state.status]}`} role="alert">
                {state.message}
              </p>
            )
          ) : null}
          {state.errors && state.errors.length > 0 ? (
            <ul role="alert" className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm text-rose-300">
              {state.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={disabled}
        className="rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Creating task…" : "Create task"}
      </button>
    </form>
  )
}
