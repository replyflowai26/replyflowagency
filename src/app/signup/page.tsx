"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client"

export default function SignupPage() {
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
        setErrorMessage("Unable to create your account. Please check your details and try again.")
        return
      }

      if (data.session) {
        window.location.assign("/dashboard")
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
    <main className="flex min-h-screen items-center justify-center bg-[#050609] px-6 text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-sm tracking-widest text-cyan-300">REPLYFLOW AI</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Create your workspace account.</h1>
        <p className="mt-3 text-white/50">Start with secure email authentication and organization onboarding.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name"
            autoComplete="name"
            required
            disabled={isSubmitting}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
          />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            autoComplete="email"
            required
            disabled={isSubmitting}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password (8+ characters)"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isSubmitting}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
          />

          {errorMessage && <p className="text-sm text-rose-300" role="alert">{errorMessage}</p>}
          {successMessage && <p className="text-sm text-emerald-300" role="status">{successMessage}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          Already have an account?{" "}
          <Link className="text-cyan-300 hover:text-cyan-200" href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  )
}
