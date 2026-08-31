"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { queueWorkflowRun } from "./run-actions"

export function WorkflowRunButton({ projectId, workflowId, clientId, disabled }: { projectId: string; workflowId: string; clientId?: string; disabled?: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setError(null)
    setPending(true)
    try {
      const formData = new FormData()
      formData.set("projectId", projectId)
      formData.set("workflowId", workflowId)
      formData.set("clientId", clientId ?? "")
      const runId = await queueWorkflowRun(formData)
      router.push(`/dashboard/projects/${projectId}/runs/${runId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to queue workflow run.")
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleRun}
        disabled={disabled || pending}
        className="rounded-lg border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Queueing…" : "Run now"}
      </button>
      {error ? <p className="max-w-56 text-right text-[10px] text-red-300">{error}</p> : null}
    </div>
  )
}
