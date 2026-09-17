"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateWorkflowMapping } from "../actions"

export function WebhookMapButton({ workflowId, mapped, disabled }: { workflowId: string; mapped: boolean; disabled?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [n8nWorkflowId, setN8nWorkflowId] = useState("")
  const [n8nWebhookPath, setN8nWebhookPath] = useState("")

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSaved(false)
    setPending(true)
    try {
      const formData = new FormData()
      formData.set("workflowId", workflowId)
      formData.set("n8nWorkflowId", n8nWorkflowId)
      formData.set("n8nWebhookPath", n8nWebhookPath)
      await updateWorkflowMapping(formData)
      setOpen(false)
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to map webhook.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {open ? (
        <form onSubmit={handleSave} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:w-80">
          <label className="text-[10px] uppercase tracking-wider text-white/35">n8n workflow id</label>
          <input value={n8nWorkflowId} onChange={(e) => setN8nWorkflowId(e.target.value)} maxLength={256} required placeholder="e.g. AbC123xYz" className="rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-cyan-300/40" />
          <label className="mt-1 text-[10px] uppercase tracking-wider text-white/35">n8n webhook path</label>
          <input value={n8nWebhookPath} onChange={(e) => setN8nWebhookPath(e.target.value)} maxLength={300} required placeholder="e.g. replyflow-runtime-abc" className="rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-cyan-300/40" />
          <div className="mt-1 flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setOpen(false); setError(null) }} disabled={pending} className="rounded-lg px-3 py-1.5 text-xs text-white/50 transition hover:bg-white/5 disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-lg border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-40">{pending ? "Saving…" : "Save mapping"}</button>
          </div>
          {error ? <p className="text-[10px] text-red-300">{error}</p> : null}
        </form>
      ) : (
        <>
          <button type="button" onClick={() => { setOpen(true); setSaved(false) }} disabled={disabled} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Map webhook</button>
          {saved ? <p className="text-[10px] text-emerald-300">Webhook mapping saved.</p> : null}
        </>
      )}
    </div>
  )
}
