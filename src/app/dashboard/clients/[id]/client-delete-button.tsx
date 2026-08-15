"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { deleteClientRecord } from "../actions"

export function ClientDeleteButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    if (!window.confirm("Delete this client permanently? This action cannot be undone.")) return
    setPending(true)
    const formData = new FormData()
    formData.set("id", clientId)
    const result = await deleteClientRecord(formData)
    if (result.error) {
      window.alert(result.error)
      setPending(false)
      return
    }
    router.replace("/dashboard/clients")
    router.refresh()
  }

  return (
    <button type="button" onClick={handleDelete} disabled={pending} className="rounded-xl border border-rose-400/20 px-4 py-2 text-sm text-rose-200 hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? "Deleting…" : "Delete"}
    </button>
  )
}
