"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client"
import { AuthShell } from "@/components/auth-shell"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage("")
    if (password.length < 8) {
      setErrorMessage("Your password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.")
      return
    }
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setErrorMessage("Unable to update your password. Request a new reset link and try again.")
        return
      }
      await supabase.auth.signOut()
      router.replace("/login?reset=success")
    } catch {
      setErrorMessage("Unable to update your password right now. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Secure password reset"
      title="Choose a new password."
      description="Update your credentials and return to the secure ReplyFlow workspace."
      footer={<p className="text-sm text-white/40"><Link className="font-medium text-cyan-300 transition hover:text-cyan-200" href="/login">Return to sign in</Link></p>}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <label className="block"><span className="mb-2 block text-xs font-medium text-white/50">New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required disabled={isSubmitting} className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/[.06] disabled:opacity-60" /></label>
        <label className="block"><span className="mb-2 block text-xs font-medium text-white/50">Confirm password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your new password" autoComplete="new-password" minLength={8} required disabled={isSubmitting} className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/[.06] disabled:opacity-60" /></label>
        {errorMessage && <div className="rounded-xl border border-rose-300/15 bg-rose-300/[.06] px-3 py-2.5 text-sm text-rose-200" role="alert">{errorMessage}</div>}
        <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Updating password…" : "Update password"}</button>
      </form>
    </AuthShell>
  )
}
