"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client"

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
    <main className="flex min-h-screen items-center justify-center bg-[#050609] px-6 text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-sm tracking-widest text-cyan-300">REPLYFLOW AI</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Choose a new password.</h1>
        <p className="mt-3 text-white/50">Use a strong password you do not reuse elsewhere.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isSubmitting}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isSubmitting}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
          />

          {errorMessage && <p className="text-sm text-rose-300" role="alert">{errorMessage}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-cyan-100 disabled:opacity-60"
          >
            {isSubmitting ? "Updating…" : "Update password"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          <Link className="text-cyan-300 hover:text-cyan-200" href="/login">Return to sign in</Link>
        </p>
      </section>
    </main>
  )
}
