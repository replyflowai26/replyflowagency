"use client"

import { useActionState } from "react"
import { createClientRecord } from "./actions"

const initialState: { error?: string; success?: string } = {}

export function ClientCreateForm() {
  const [state, formAction, isPending] = useActionState(createClientRecord, initialState)

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-5 sm:grid-cols-2">
      <input name="name" required placeholder="Company / client name" className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-sm text-white outline-none focus:border-cyan-300/40" />
      <input name="contactName" placeholder="Contact person" className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-sm text-white outline-none focus:border-cyan-300/40" />
      <input name="email" type="email" placeholder="Work email" className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-sm text-white outline-none focus:border-cyan-300/40" />
      <input name="phone" placeholder="Phone / WhatsApp" className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-sm text-white outline-none focus:border-cyan-300/40" />
      <input name="websiteUrl" type="url" placeholder="https://company.com" className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-sm text-white outline-none focus:border-cyan-300/40" />
      <input name="industry" placeholder="Industry" className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-sm text-white outline-none focus:border-cyan-300/40" />
      <input name="source" placeholder="Source (website, referral, outreach...)" className="h-11 rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-sm text-white outline-none focus:border-cyan-300/40" />
      <textarea name="notes" placeholder="Initial notes" rows={1} className="rounded-xl border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40" />
      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={isPending} className="h-11 rounded-xl bg-white px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60">{isPending ? "Creating…" : "Add client"}</button>
        {state.error && <p className="text-sm text-rose-200" role="alert">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-200" role="status">{state.success}</p>}
      </div>
    </form>
  )
}
