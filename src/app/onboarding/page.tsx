"use client"

import { useActionState } from "react"
import { createOrganization } from "./actions"

const initialState: { error?: string } = {}

export default function OnboardingPage() {
  const [state, formAction, isPending] = useActionState(createOrganization, initialState)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050609] px-6 text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-sm tracking-widest text-cyan-300">REPLYFLOW AI</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Create your first organization.</h1>
        <p className="mt-3 text-white/50">This becomes your isolated Company OS workspace.</p>

        <form className="mt-8 space-y-4" action={formAction}>
          <input
            name="name"
            placeholder="Organization name"
            autoComplete="organization"
            required
            minLength={2}
            maxLength={120}
            disabled={isPending}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40 disabled:opacity-60"
          />
          <input
            name="slug"
            placeholder="organization-slug"
            autoComplete="off"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            maxLength={80}
            disabled={isPending}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40 disabled:opacity-60"
          />

          {state.error && <p className="text-sm text-rose-300" role="alert">{state.error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Creating…" : "Create organization"}
          </button>
        </form>
      </section>
    </main>
  )
}
