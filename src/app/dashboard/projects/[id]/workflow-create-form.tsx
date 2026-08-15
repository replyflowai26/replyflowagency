"use client"

import { useState } from "react"
import { createWorkflow } from "../actions"

export function WorkflowCreateForm({ projectId }: { projectId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]"
      action={async (formData) => {
        setError(null)
        setPending(true)
        try {
          await createWorkflow(formData)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to create workflow.")
        } finally {
          setPending(false)
        }
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input name="name" required maxLength={160} placeholder="Workflow name" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40" />
      <input name="description" maxLength={500} placeholder="What should this workflow handle?" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40" />
      <button disabled={pending} className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Creating…" : "Create workflow"}</button>
      {error ? <p className="text-xs text-red-300 sm:col-span-3">{error}</p> : null}
    </form>
  )
}
