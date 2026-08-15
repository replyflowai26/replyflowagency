"use client"

import { motion } from "motion/react"
import { useActionState } from "react"
import { submitContactLead } from "@/app/contact/actions"

const initialState = { error: "", success: false }

export function CTA() {
  const [state, formAction, isPending] = useActionState(submitContactLead, initialState)

  return (
    <motion.section
      id="contact"
      className="relative overflow-hidden py-28 sm:py-36"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7 }}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/[0.06] blur-[120px]" />
      <div className="container relative">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.035] to-cyan-300/[0.025] p-7 shadow-2xl sm:p-12 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-1.5 text-xs tracking-[0.15em] text-cyan-300">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan-300" />
                READY WHEN YOU ARE
              </div>
              <h2 className="mt-6 max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
                Let&apos;s automate the work your team shouldn&apos;t be doing manually.
              </h2>
              <p className="mt-7 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
                Tell us what is repetitive, slow or leaking revenue. We&apos;ll map the system before recommending a build.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-white/40 sm:max-w-md">
                {[
                  ["01", "Business audit"],
                  ["02", "Automation map"],
                  ["03", "Build plan"],
                  ["04", "Scale & optimize"],
                ].map(([number, label]) => (
                  <div key={number} className="rounded-xl border border-white/8 bg-black/10 p-3">
                    <span className="font-mono text-cyan-300/50">{number}</span>
                    <p className="mt-2 text-white/60">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl sm:p-6">
              {state.success ? (
                <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-2xl text-cyan-300">✓</div>
                  <h3 className="mt-5 text-2xl font-semibold text-white">Request received.</h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/45">Your automation brief is in our queue. We&apos;ll review the workflow and get back to you.</p>
                </div>
              ) : (
                <form action={formAction} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-wider text-white/35">Name</span>
                      <input name="name" required maxLength={120} placeholder="Your name" className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/30" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-wider text-white/35">Work email</span>
                      <input name="email" type="email" required maxLength={200} placeholder="you@company.com" className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/30" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-white/35">Company</span>
                    <input name="company" maxLength={160} placeholder="Company name" className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/30" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-white/35">What should we automate?</span>
                    <textarea name="message" required minLength={10} maxLength={3000} rows={6} placeholder="Tell us about the repetitive work, bottleneck or workflow you want to automate..." className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-cyan-300/30" />
                  </label>

                  {state.error && <p className="text-sm text-rose-300" role="alert">{state.error}</p>}

                  <motion.button
                    type="submit"
                    disabled={isPending}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.985 }}
                    className="w-full rounded-xl bg-white px-6 py-3.5 font-semibold text-black transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Sending brief…" : "Start the automation conversation →"}
                  </motion.button>
                  <p className="text-center text-[11px] leading-5 text-white/25">No spam. We&apos;ll only use these details to respond to your request.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
