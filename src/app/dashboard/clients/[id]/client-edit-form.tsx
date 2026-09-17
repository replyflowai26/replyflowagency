"use client"

import { useRef, useState } from "react"
import { updateClientRecord } from "../actions"
import { runGuardedSubmit } from "@/lib/forms/guarded-submit"
import { CLIENT_STATUSES, OUTREACH_STATUSES, type Client } from "@/types/client"

const initialState: { error?: string; success?: string } = {}

function OutreachLabel(status: string) {
  return status.split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ")
}

export function ClientEditForm({ client }: { client: Client }) {
  const [state, setState] = useState(initialState)
  const [isSaving, setIsSaving] = useState(false)
  const inFlightRef = useRef(false)

  async function handleSave(formData: FormData) {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsSaving(true)
    await runGuardedSubmit({
      execute: () => updateClientRecord(state, formData),
      onResolved: (next) => setState(next),
      onRejected: (next) => setState(next),
      onSettled: () => {
        setIsSaving(false)
        inFlightRef.current = false
      },
      errorMessage: "Unable to save client. Please try again.",
    })
  }

  return (
    <form action={handleSave} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={client.id} />
      <label className="grid gap-2 text-sm text-white/60">Company / client name<input name="name" required defaultValue={client.name} className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-white outline-none focus:border-cyan-300/40" /></label>
      <label className="grid gap-2 text-sm text-white/60">Contact person<input name="contactName" defaultValue={client.contact_name ?? ""} className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-white outline-none focus:border-cyan-300/40" /></label>
      <label className="grid gap-2 text-sm text-white/60">Work email<input name="email" type="email" defaultValue={client.email ?? ""} className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-white outline-none focus:border-cyan-300/40" /></label>
      <label className="grid gap-2 text-sm text-white/60">Phone / WhatsApp<input name="phone" defaultValue={client.phone ?? ""} className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-white outline-none focus:border-cyan-300/40" /></label>
      <label className="grid gap-2 text-sm text-white/60">Website<input name="websiteUrl" type="url" defaultValue={client.website_url ?? ""} className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-white outline-none focus:border-cyan-300/40" /></label>
      <label className="grid gap-2 text-sm text-white/60">Industry<input name="industry" defaultValue={client.industry ?? ""} className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-white outline-none focus:border-cyan-300/40" /></label>
      <label className="grid gap-2 text-sm text-white/60">Source<input name="source" defaultValue={client.source ?? ""} className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-white outline-none focus:border-cyan-300/40" /></label>
      <label className="grid gap-2 text-sm text-white/60">Status<select name="status" defaultValue={client.status} className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-white outline-none focus:border-cyan-300/40">{CLIENT_STATUSES.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>
      <label className="grid gap-2 text-sm text-white/60">Outreach status<select name="outreachStatus" defaultValue={client.outreach_status} className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-white outline-none focus:border-cyan-300/40">{OUTREACH_STATUSES.map((status) => <option key={status} value={status}>{OutreachLabel(status)}</option>)}</select></label>
      <label className="grid gap-2 text-sm text-white/60">Next follow-up<input name="nextFollowUpAt" type="date" defaultValue={client.next_follow_up_at?.slice(0, 10) ?? ""} className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-white outline-none focus:border-cyan-300/40" /></label>
      <label className="grid gap-2 text-sm text-white/60 sm:col-span-2">Notes<textarea name="notes" rows={5} defaultValue={client.notes ?? ""} className="rounded-xl border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-white outline-none focus:border-cyan-300/40" /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={isSaving} className="h-11 rounded-xl bg-white px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Saving…" : "Save changes"}</button>
        {state.error && <p className="text-sm text-rose-200" role="alert">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-200" role="status">{state.success}</p>}
      </div>
    </form>
  )
}
