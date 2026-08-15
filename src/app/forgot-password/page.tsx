"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client"

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
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
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
    <main className="flex min-h-screen items-center justify-center bg-[#050609] px-6 text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-sm tracking-widest text-cyan-300">REPLYFLOW AI</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Reset your password.</h1>
        <p className="mt-3 text-white/50">We will send a secure recovery link if the account exists.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
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
          {message && <p className="text-sm text-cyan-200" role="status">{message}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-cyan-100 disabled:opacity-60"
          >
            {isSubmitting ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          <Link className="text-cyan-300 hover:text-cyan-200" href="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  )
}
