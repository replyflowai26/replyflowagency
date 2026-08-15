"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { createProject } from "./actions"

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending} type="submit" className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Creating…" : "Create project"}</button>
}

export function ProjectCreateForm() {
  const [error, setError] = useState<string | null>(null)

  return (
    <form action={async (formData) => {
      setError(null)
      try {
        await createProject(formData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to create project.")
      }
    }} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
      <label className="text-xs text-white/45">Name<input name="name" required maxLength={160} placeholder="Lead generation system" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-cyan-300/30" /></label>
      <label className="text-xs text-white/45">Description<input name="description" maxLength={500} placeholder="What this project is responsible for" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-cyan-300/30" /></label>
      <SubmitButton />
      {error ? <p className="text-xs text-rose-300 sm:col-span-3">{error}</p> : null}
    </form>
  )
}
