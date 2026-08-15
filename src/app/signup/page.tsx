"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client"
import { AuthShell } from "@/components/auth-shell"

function signupErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes("already registered") || normalized.includes("already exists") || normalized.includes("user already")) {
    return "An account with this email already exists. Sign in instead or use Forgot password."
  }
  if (normalized.includes("password")) return "Password does not meet Supabase security requirements. Use at least 8 characters and try again."
  if (normalized.includes("email")) return "Please enter a valid email address."
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) return "Too many signup attempts. Please wait a moment and try again."
  return "Unable to create your account. Please check your details and try again."
}

export default function SignupPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")

    const normalizedEmail = email.trim()
    const normalizedName = displayName.trim()

    if (!normalizedEmail || !normalizedName || password.length < 8) {
      setErrorMessage("Enter your name, a valid email, and a password of at least 8 characters.")
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { display_name: normalizedName },
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
        },
      })

      if (error) {
        setErrorMessage(signupErrorMessage(error.message))
        return
      }

      if (data.session) {
        router.replace("/dashboard")
        router.refresh()
        return
      }

      setSuccessMessage("Account created. Check your email to confirm your address before signing in.")
      setPassword("")
    } catch {
      setErrorMessage("Unable to create your account right now. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Create workspace"
      title="Start your workspace."
      description="Create your ReplyFlow account and move into a secure operating workspace."
      footer={
        <p className="text-sm text-white/40">
          Already have an account? <Link href="/login" className="font-medium text-cyan-300 transition hover:text-cyan-200">Sign in</Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-white/50">Your name</span>
          <input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Tommy" autoComplete="name" required disabled={isSubmitting} className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/[.06] disabled:opacity-60" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-white/50">Work email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required disabled={isSubmitting} className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/[.06] disabled:opacity-60" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-white/50">Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required disabled={isSubmitting} className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/[.06] disabled:opacity-60" />
        </label>
        {errorMessage && <div className="rounded-xl border border-rose-300/15 bg-rose-300/[.06] px-3 py-2.5 text-sm text-rose-200" role="alert">{errorMessage}</div>}
        {successMessage && <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.06] px-3 py-2.5 text-sm text-emerald-200" role="status">{successMessage}</div>}
        <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Creating workspace…" : "Create workspace"}</button>
      </form>
    </AuthShell>
  )
}
