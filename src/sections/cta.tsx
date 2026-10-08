"use client"

import { motion, useReducedMotion } from "motion/react"
import { useActionState } from "react"
import { submitContactLead } from "@/app/contact/actions"
import { staggerContainer, staggerContainerInstant, fadeUp, fadeUpInstant, fadeFromLeft, fadeFromLeftInstant, scaleIn, scaleInInstant, cardViewport } from "@/lib/motion"
import { Reveal } from "@/components/reveal"

const initialState = { error: "", success: false }

const trustSignals = [
  {
    label: "CONNECTED BY DESIGN",
    tone: "bg-cyan-300",
    text: "Lead capture, CRM, messaging and AI run as one flow.",
  },
  {
    label: "SECURE DATA",
    tone: "bg-sky-300",
    text: "Authentication and data handled with Supabase.",
  },
  {
    label: "HUMAN-CONTROLLED",
    tone: "bg-violet-300",
    text: "Starts with an audit and a design we review with you.",
  },
]

const conversationFlow = [
  { label: "You describe the repetitive work", detail: "The bottleneck, the tools involved and the outcome you need." },
  { label: "ReplyFlow maps the workflow", detail: "We design the system before recommending a build." },
  { label: "The automation gets built", detail: "AI, CRM and messaging connected into one working flow." },
  { label: "The work runs on its own", detail: "Your team moves from repeating tasks to running the business." },
]

const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition-colors duration-200 placeholder:text-white/25 focus:border-cyan-300/40 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(103,232,249,.05)]"

export function CTA() {
  const [state, formAction, isPending] = useActionState(submitContactLead, initialState)
  const reduceMotion = useReducedMotion()
  const stagger = reduceMotion ? staggerContainerInstant : staggerContainer
  const fadeUpV = reduceMotion ? fadeUpInstant : fadeUp
  const fadeFromLeftV = reduceMotion ? fadeFromLeftInstant : fadeFromLeft
  const scaleInV = reduceMotion ? scaleInInstant : scaleIn

  return (
    <section id="contact" className="relative overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/[0.06] blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-violet-500/[0.05] blur-[110px]" />
      <div className="container relative">
        <Reveal className="mb-8">
          <ul className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-3 sm:p-5" aria-label="Reliability signals">
            {trustSignals.map((signal) => (
              <li key={signal.label} className="flex items-start gap-3">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${signal.tone}`} aria-hidden="true" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{signal.label}</p>
                  <p className="mt-1 text-sm leading-5 text-white/70">{signal.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <motion.div
          className="relative overflow-hidden rounded-[2rem] border border-cyan-300/[0.10] bg-[#08111F]/80 bg-gradient-to-br from-[#08111F]/90 via-[#08111F]/60 to-cyan-300/[0.04] p-7 shadow-[0_40px_120px_rgba(0,0,0,0.55)] sm:p-12 lg:p-14"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={cardViewport}
        >
          <div aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
          <div aria-hidden="true" className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-cyan-300/15 to-transparent" />
          <div aria-hidden="true" className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-violet-300/10 to-transparent" />
          <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
            <div>
              <motion.div
                variants={fadeFromLeftV}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-1.5 text-xs tracking-[0.15em] text-cyan-300"
              >
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan-300" />
                READY WHEN YOU ARE
              </motion.div>
              <motion.h2 variants={fadeUpV} className="mt-6 max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
                Let&apos;s automate the work your team shouldn&apos;t be doing manually.
              </motion.h2>
              <motion.p variants={fadeUpV} className="mt-7 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
                Tell us what is repetitive, slow or leaking revenue. We&apos;ll map the system before recommending a build.
              </motion.p>

              <motion.div variants={fadeUpV} className="mt-8 max-w-md">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/30">
                  How a conversation becomes a system
                </p>
                <ol className="mt-4" aria-label="From problem to outcome">
                  {conversationFlow.map((stage, index) => (
                    <li key={stage.label} className="relative flex gap-3.5">
                      <div className="flex flex-col items-center" aria-hidden="true">
                        <span className="mt-1.5 h-2 w-2 rounded-full border border-cyan-300/50 bg-cyan-300/20" />
                        {index < conversationFlow.length - 1 && (
                          <span className="relative my-1.5 min-h-[28px] w-px flex-1 bg-white/12">
                            <span className="workflow-pulse workflow-pulse-v" style={{ animationDelay: `${index * 0.5}s` }} />
                          </span>
                        )}
                      </div>
                      <div className={index < conversationFlow.length - 1 ? "pb-5" : ""}>
                        <p className="text-sm font-medium text-white/85">
                          <span className="mr-2 font-mono text-[11px] tracking-widest text-cyan-300/50">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {stage.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-white/40">{stage.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/30">
                  <span>Map before build</span>
                  <span className="h-px w-6 bg-white/15" aria-hidden="true" />
                  <span>No spam</span>
                </div>
              </motion.div>
            </div>

            <motion.div variants={scaleInV} className="rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl sm:p-6">
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
                      <input name="name" required maxLength={120} placeholder="Your name" className={inputClass} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-wider text-white/35">Work email</span>
                      <input name="email" type="email" required maxLength={200} placeholder="you@company.com" className={inputClass} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-white/35">Company</span>
                    <input name="company" maxLength={160} placeholder="Company name" className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-white/35">What should we automate?</span>
                    <textarea name="message" required minLength={10} maxLength={3000} rows={6} placeholder="Tell us about the repetitive work, bottleneck or workflow you want to automate..." className={`${inputClass} resize-none leading-6`} />
                  </label>

                  {state.error && <p className="text-sm text-rose-300" role="alert">{state.error}</p>}

                  <motion.button
                    type="submit"
                    disabled={isPending}
                    whileHover={reduceMotion ? {} : { y: -2 }}
                    whileTap={reduceMotion ? {} : { scale: 0.985 }}
                    className="w-full rounded-xl bg-white px-6 py-3.5 font-semibold text-black transition hover:bg-cyan-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Sending brief…" : "Start the automation conversation →"}
                  </motion.button>
                  <p className="text-center text-[11px] leading-5 text-white/25">No spam. We&apos;ll only use these details to respond to your request.</p>
                </form>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}