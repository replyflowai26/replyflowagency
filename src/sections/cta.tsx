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
    tone: "bg-blue-600",
    text: "Lead capture, CRM, messaging and AI run as one flow.",
  },
  {
    label: "SECURE DATA",
    tone: "bg-sky-600",
    text: "Authentication and data handled with Supabase.",
  },
  {
    label: "HUMAN-CONTROLLED",
    tone: "bg-indigo-500",
    text: "Starts with an audit and a design we review with you.",
  },
]

const conversationFlow = [
  { label: "You describe the repetitive work", detail: "The bottleneck, the tools involved and the outcome you need." },
  { label: "ReplyFlow maps the workflow", detail: "We design the system before recommending a build." },
  { label: "The automation gets built", detail: "AI, CRM and messaging connected into one working flow." },
  { label: "The work runs on its own", detail: "Your team moves from repeating tasks to running the business." },
]

const inputClass = "w-full rounded-xl border border-line-ink bg-paper-lift px-4 py-3 text-sm text-ink outline-none transition-colors duration-200 placeholder:text-ink-soft focus:border-blue-ink focus:bg-paper-lift focus:shadow-[0_0_0_3px_rgba(31,92,197,.12)]"

export function CTA() {
  const [state, formAction, isPending] = useActionState(submitContactLead, initialState)
  const reduceMotion = useReducedMotion()
  const stagger = reduceMotion ? staggerContainerInstant : staggerContainer
  const fadeUpV = reduceMotion ? fadeUpInstant : fadeUp
  const fadeFromLeftV = reduceMotion ? fadeFromLeftInstant : fadeFromLeft
  const scaleInV = reduceMotion ? scaleInInstant : scaleIn

  return (
    <section id="contact" className="relative overflow-hidden py-16 sm:py-24">
      <div className="container relative">
        <Reveal className="mb-8">
          <ul className="print-flat grid gap-4 rounded-2xl p-4 sm:grid-cols-3 sm:p-5" aria-label="Reliability signals">
            {trustSignals.map((signal) => (
              <li key={signal.label} className="flex items-start gap-3">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${signal.tone}`} aria-hidden="true" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-blue-ink">{signal.label}</p>
                  <p className="mt-1 text-sm leading-5 text-ink-muted">{signal.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <motion.div
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink p-7 shadow-[0_40px_120px_rgba(0,0,0,0.55)] sm:p-12 lg:p-14"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={cardViewport}
        >
          <div aria-hidden="true" className="print-halftone pointer-events-none absolute inset-0 opacity-50" />
          <div aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/35 to-transparent" />
          <div aria-hidden="true" className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-blue-300/15 to-transparent" />
          <div aria-hidden="true" className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-indigo-300/10 to-transparent" />
          <div aria-hidden="true" className="rule-warm absolute inset-x-16 bottom-0" />
          <div className="relative grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div>
              <motion.div
                variants={fadeFromLeftV}
                className="inline-flex items-center gap-2 rounded-full border border-blue-300/15 bg-blue-300/[0.05] px-3 py-1.5 text-xs tracking-[0.15em] text-blue-200"
              >
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-blue-300" />
                READY WHEN YOU ARE
              </motion.div>
              <motion.h2 variants={fadeUpV} className="font-display mt-6 max-w-xl text-4xl font-semibold leading-[1.02] text-white sm:text-5xl lg:text-6xl">
                Let&apos;s automate the work your team shouldn&apos;t be doing manually.
              </motion.h2>
              <motion.p variants={fadeUpV} className="mt-7 max-w-xl text-base leading-7 text-white/60 sm:text-lg">
                Tell us what is repetitive, slow or leaking revenue. We&apos;ll map the system before recommending a build.
              </motion.p>

              <motion.div variants={fadeUpV} className="mt-8 max-w-md">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">
                  How a conversation becomes a system
                </p>
                <ol className="mt-4" aria-label="From problem to outcome">
                  {conversationFlow.map((stage, index) => (
                    <li key={stage.label} className="relative flex gap-3.5">
                      <div className="flex flex-col items-center" aria-hidden="true">
                        <span className="mt-1.5 h-2 w-2 rounded-full border border-blue-300/50 bg-blue-300/20" />
                        {index < conversationFlow.length - 1 && (
                          <span className="relative my-1.5 min-h-[28px] w-px flex-1 bg-white/12">
                            <span className="workflow-pulse workflow-pulse-v" style={{ animationDelay: `${index * 0.5}s` }} />
                          </span>
                        )}
                      </div>
                      <div className={index < conversationFlow.length - 1 ? "pb-5" : ""}>
                        <p className="text-sm font-medium text-white/85">
                          <span className="mr-2 font-mono text-[11px] tracking-widest text-blue-300/85">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {stage.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-white/55">{stage.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/60">
                  <span>Map before build</span>
                  <span className="h-px w-6 bg-white/15" aria-hidden="true" />
                  <span>No spam</span>
                </div>
              </motion.div>
            </div>

            <motion.div variants={scaleInV} className="print-flat rounded-3xl p-5 sm:p-6">
              {state.success ? (
                <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-600/30 bg-emerald-600/10 text-2xl text-emerald-700">✓</div>
                  <h3 className="mt-5 font-display text-2xl font-semibold text-ink">Request received.</h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-ink-muted">Your automation brief is in our queue. We&apos;ll review the workflow and get back to you.</p>
                </div>
              ) : (
                <form action={formAction} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-wider text-ink-muted">Name</span>
                      <input name="name" required maxLength={120} placeholder="Your name" className={inputClass} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-wider text-ink-muted">Work email</span>
                      <input name="email" type="email" required maxLength={200} placeholder="you@company.com" className={inputClass} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-ink-muted">Company</span>
                    <input name="company" maxLength={160} placeholder="Company name" className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-ink-muted">What should we automate?</span>
                    <textarea name="message" required minLength={10} maxLength={3000} rows={6} placeholder="Tell us about the repetitive work, bottleneck or workflow you want to automate..." className={`${inputClass} resize-none leading-6`} />
                  </label>

                  {state.error && <p className="text-sm text-rose-600" role="alert">{state.error}</p>}

                  <motion.button
                    type="submit"
                    disabled={isPending}
                    whileHover={reduceMotion ? {} : { y: -2 }}
                    whileTap={reduceMotion ? {} : { scale: 0.985 }}
                    className="w-full rounded-xl bg-ink px-6 py-3.5 font-semibold text-paper transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-ink disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Sending brief…" : "Start the automation conversation →"}
                  </motion.button>
                  <p className="text-center text-[11px] leading-5 text-ink-muted">No spam. We&apos;ll only use these details to respond to your request.</p>
                </form>
              )}
            </motion.div>
          </div>
        </motion.div>

        <Reveal delay={0.1} className="mt-5">
          <div className="print-flat flex flex-col gap-4 rounded-2xl px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-blue-ink">First step · Automation Assessment</p>
              <p className="mt-1.5 text-sm leading-6 text-ink-muted">
                Start with one workflow: we map it, name the automation opportunities, and agree the build before any engagement.
              </p>
            </div>
            <a
              href="#contact"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-paper transition-colors duration-200 hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-ink"
            >
              Start with one workflow <span aria-hidden="true">→</span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}