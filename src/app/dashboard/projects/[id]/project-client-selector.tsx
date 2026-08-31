"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateProjectClient } from "../actions"

export function ProjectClientSelector({ projectId, clients, currentClientId }: { projectId: string; clients: { id: string; name: string }[]; currentClientId: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState<string>(currentClientId ?? "")
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<{ type: "error" | "success"; text: string } | null>(null)

  async function handleChange(next: string) {
    setPending(true)
    setStatus(null)
    try {
      const formData = new FormData()
      formData.set("projectId", projectId)
      formData.set("clientId", next)
      await updateProjectClient(formData)
      setValue(next)
      setStatus({ type: "success", text: next ? "Client linked." : "Client unlinked." })
      router.refresh()
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Unable to update client link." })
      setValue(currentClientId ?? "")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs text-white/45">Linked client
        <select
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          disabled={pending}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/30 disabled:opacity-50 min-w-52"
        >
          <option value="">No client linked</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      </label>
      {pending ? <span className="text-xs text-white/40">Saving…</span> : null}
      {status ? <span className={`text-xs ${status.type === "error" ? "text-rose-300" : "text-emerald-300"}`}>{status.text}</span> : null}
    </div>
  )
}
