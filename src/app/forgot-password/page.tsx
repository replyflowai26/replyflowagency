"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client"
import { AuthShell } from "@/components/auth-shell"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setMessage("Enter your email address.")
      return
    }
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      })
      if (error) {
        setMessage("Unable to start password recovery. Please try again.")
        return
      }
      setMessage("If an account exists for that email, a password reset link has been sent.")
    } catch {
      setMessage("Unable to start password recovery right now. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset access securely."
      description="Request a recovery link and return to your ReplyFlow workspace."
      footer={<p className="text-sm text-white/40"><Link className="font-medium text-cyan-300 transition hover:text-cyan-200" href="/login">Back to sign in</Link></p>}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <label className="block"><span className="mb-2 block text-xs font-medium text-white/50">Work email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required disabled={isSubmitting} className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/[.06] disabled:opacity-60" /></label>
        {message && <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.06] px-3 py-2.5 text-sm text-cyan-100" role="status">{message}</div>}
        <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Sending secure link…" : "Send recovery link"}</button>
      </form>
    </AuthShell>
  )
}
