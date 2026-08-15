"use client"

import { useState } from "react"
import { updateWorkflowStatus } from "./run-actions"

export function WorkflowStatusButton({ workflowId, status, disabled }: { workflowId: string; status: string; disabled?: boolean }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nextStatus = status === "active" ? "paused" : "active"

  async function handleChange() {
    setError(null)
    setPending(true)
    try {
      const formData = new FormData()
      formData.set("workflowId", workflowId)
      formData.set("status", nextStatus)
      await updateWorkflowStatus(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update workflow status.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button type="button" onClick={handleChange} disabled={disabled || pending} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">
        {pending ? "Saving…" : status === "active" ? "Pause" : "Activate"}
      </button>
      {error ? <p className="max-w-56 text-right text-[10px] text-red-300">{error}</p> : null}
    </div>
  )
}
