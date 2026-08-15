"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { useRouter, useSearchParams } from "next/navigation"
import { type FormEvent, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const systemRows = [
  ["Lead intake", "Connected"],
  ["Qualification", "AI running"],
  ["Follow-up", "Automated"],
  ["Reporting", "Synced"],
]

export function LampLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const queryMessage =
    searchParams.get("error") === "auth_callback" || searchParams.get("error") === "auth_confirmation"
      ? "That authentication link is invalid or expired. Please request a new one."
      : searchParams.get("reset") === "success"
        ? "Password updated successfully. Sign in with your new password."
        : ""

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage("")

    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      setErrorMessage("Enter your email address and password.")
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        setErrorMessage("Unable to sign in. Check your email and password.")
        return
      }

      router.replace("/dashboard")
      router.refresh()
    } catch {
      setErrorMessage("Unable to sign in right now. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070b] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(124,58,237,.18),transparent_30rem),radial-gradient(circle_at_82%_72%,rgba(34,211,238,.12),transparent_30rem)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:56px_56px]" />

      <header className="relative z-20 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl sm:px-5">
          <Link href="/" className="flex items-center gap-3" aria-label="ReplyFlow AI home">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10">
              <span className="pulse-dot h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span className="font-semibold tracking-tight">ReplyFlow AI</span>
          </Link>
          <Link href="/" className="text-sm text-white/55 transition hover:text-white">
            Back to website
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="hidden lg:block"
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-xs font-medium tracking-wide text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            PRIVATE OPERATING SYSTEM
          </div>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.03] tracking-[-0.04em] xl:text-7xl">
            Your business,
            <span className="text-gradient block">running in flow.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/55">
            Sign in to the ReplyFlow workspace to manage clients, automations, workflows and the systems that run behind your business.
          </p>

          <div className="mt-10 max-w-xl rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between border-b border-white/8 pb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/35">Automation network</p>
                <p className="mt-1 text-sm text-white/70">ReplyFlow production systems</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1 text-[11px] text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Operational
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {systemRows.map(([label, status], index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + index * 0.08, duration: 0.35 }}
                  className="rounded-2xl border border-white/8 bg-black/20 p-4"
                >
                  <p className="text-[11px] uppercase tracking-wider text-white/30">{label}</p>
                  <p className="mt-3 text-sm font-medium text-white/85">{status}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/6">
              <motion.div
                initial={{ width: "15%" }}
                animate={{ width: "82%" }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300"
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="mx-auto w-full max-w-md"
        >
          <div className="rounded-[2rem] border border-white/10 bg-[#0b0e14]/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,.45)] backdrop-blur-2xl sm:p-8">
            <div className="mb-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-300/10">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(196,181,253,.7)]" />
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Workspace access</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back.</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">Sign in to continue managing your automation systems.</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-white/50">Work email</span>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:bg-black/40 focus:ring-4 focus:ring-cyan-300/[0.06] disabled:opacity-60"
                />
              </label>

              <label className="block">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-white/50">Password</span>
                  <Link href="/forgot-password" className="text-xs text-cyan-300/80 transition hover:text-cyan-200">Forgot password?</Link>
                </div>
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:bg-black/40 focus:ring-4 focus:ring-cyan-300/[0.06] disabled:opacity-60"
                />
              </label>

              {(errorMessage || queryMessage) && (
                <div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-3 py-2.5 text-sm text-rose-200" role="alert">
                  {errorMessage || queryMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative mt-2 h-12 w-full overflow-hidden rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="relative z-10">{isSubmitting ? "Signing in…" : "Sign in to workspace"}</span>
                {!isSubmitting && <span className="absolute inset-y-0 right-0 w-1/3 bg-cyan-200/30 blur-xl transition-transform duration-500 group-hover:translate-x-3" />}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-white/20">
              <span className="h-px flex-1 bg-white/8" />
              Secure workspace access
              <span className="h-px flex-1 bg-white/8" />
            </div>

            <p className="text-center text-sm text-white/40">
              New to ReplyFlow?{" "}
              <Link href="/signup" className="font-medium text-cyan-300 transition hover:text-cyan-200">Create your workspace</Link>
            </p>
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-white/25">
            By continuing, you agree to use this workspace only for authorized business operations.
          </p>
        </motion.div>
      </section>
    </main>
  )
}
