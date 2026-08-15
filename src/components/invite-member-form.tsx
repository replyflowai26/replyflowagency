"use client"

import { useActionState } from "react"
import { inviteOrganizationMember } from "@/app/dashboard/invitations/actions"

const initialState: { error?: string; success?: boolean } = {}

export function InviteMemberForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, isPending] = useActionState(inviteOrganizationMember, initialState)

  return (
    <form action={formAction} className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-5">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="email"
          name="email"
          placeholder="Invite by email"
          autoComplete="email"
          required
          disabled={isPending}
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
        />
        <select
          name="role"
          defaultValue="member"
          disabled={isPending}
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
        >
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>

      {state.error && <p className="text-sm text-rose-300" role="alert">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-300" role="status">Invitation sent successfully.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Send invitation"}
      </button>
    </form>
  )
}
