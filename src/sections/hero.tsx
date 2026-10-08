"use client"

import { motion, useReducedMotion, type Variants } from "motion/react"
import {
  EASE,
  staggerContainer,
  staggerContainerInstant,
  fadeUp,
  fadeUpInstant,
  fadeUpLarge,
  fadeUpLargeInstant,
  fadeFromLeft,
  fadeFromLeftInstant,
  scaleInInstant,
} from "@/lib/motion"

const signals = ["LEADS", "SALES", "SUPPORT", "OPS"]

const pipeline = [
  { step: "01", label: "Lead", detail: "Enquiry captured", status: "LIVE", pulse: true, ai: false, dot: "bg-cyan-300", chip: "text-cyan-300/85 border-cyan-300/20 bg-cyan-300/[0.07]" },
  { step: "02", label: "AI", detail: "Qualify & respond", status: "RUNNING", pulse: false, ai: true, dot: "bg-violet-300", chip: "text-violet-300/85 border-violet-300/20 bg-violet-300/[0.07]" },
  { step: "03", label: "CRM", detail: "Record synced", status: "SYNCED", pulse: false, ai: true, dot: "bg-sky-300", chip: "text-sky-300/85 border-sky-300/20 bg-sky-300/[0.07]" },
  { step: "04", label: "WhatsApp / Email", detail: "Message delivered", status: "SENT", pulse: false, ai: false, dot: "bg-cyan-300", chip: "text-cyan-300/85 border-cyan-300/20 bg-cyan-300/[0.07]" },
  { step: "05", label: "Follow-up", detail: "Sequenced outreach", status: "QUEUED", pulse: false, ai: false, dot: "bg-sky-300", chip: "text-sky-300/85 border-sky-300/20 bg-sky-300/[0.07]" },
  { step: "06", label: "Reporting", detail: "Metrics streaming", status: "LIVE", pulse: true, ai: false, dot: "bg-emerald-300", chip: "text-emerald-300/85 border-emerald-300/20 bg-emerald-300/[0.07]" },
]

export function Hero() {
  const reduceMotion = useReducedMotion()
  const stagger = reduceMotion ? staggerContainerInstant : staggerContainer
  const fadeUpV = reduceMotion ? fadeUpInstant : fadeUp
  const fadeUpLargeV = reduceMotion ? fadeUpLargeInstant : fadeUpLarge
  const fadeFromLeftV = reduceMotion ? fadeFromLeftInstant : fadeFromLeft

  const visualEntrance: Variants = reduceMotion
    ? scaleInInstant
    : {
        hidden: { opacity: 0, scale: 0.94, y: 20 },
        visible: {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { duration: 0.9, ease: EASE, delay: 0.55 },
        },
      }

  return (
    <section className="grid-bg relative flex min-h-[760px] items-center overflow-hidden pt-28 sm:min-h-screen">
      <div className="hero-depth absolute inset-0" aria-hidden="true">
        <div className="hero-network absolute inset-0 opacity-80" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,transparent_0,rgba(5,7,11,.18)_42%,rgba(5,7,11,.82)_100%)]" />
        <div className="pointer-events-none absolute left-1/2 top-[12%] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute right-[-8rem] top-[28%] h-72 w-72 rounded-full bg-cyan-400/10 blur-[100px]" />
      </div>

      <div className="container relative py-20 sm:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-8">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="relative z-10 max-w-3xl"
          >
            <motion.div
              variants={fadeFromLeftV}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-2 text-sm text-white/70 backdrop-blur-md"
            >
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan-300" />
              AI automation for ambitious businesses
            </motion.div>

            <motion.h1 variants={fadeUpLargeV} className="text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-7xl lg:text-[5.4rem]">
              Stop doing manually
              <span className="block text-gradient">what AI can run.</span>
            </motion.h1>

            <motion.p variants={fadeUpV} className="mt-7 max-w-2xl text-base leading-7 text-white/60 sm:text-lg sm:leading-8">
              ReplyFlow AI designs connected automation systems for lead generation,
              sales, customer support and operations — so your team can focus on growth.
            </motion.p>

            <motion.div variants={fadeUpV} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <motion.a
                href="#contact"
                whileHover={reduceMotion ? {} : { y: -2, scale: 1.015 }}
                whileTap={reduceMotion ? {} : { scale: 0.985 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="rounded-xl bg-white px-6 py-3.5 text-center font-semibold text-black shadow-[0_0_40px_rgba(255,255,255,.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70"
              >
                Build my automation <span className="ml-1">→</span>
              </motion.a>
              <motion.a
                href="#services"
                whileHover={reduceMotion ? {} : { y: -2 }}
                whileTap={reduceMotion ? {} : { scale: 0.985 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="glass rounded-xl px-6 py-3.5 text-center font-semibold text-white/85 transition hover:border-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70"
              >
                Explore systems
              </motion.a>
            </motion.div>

            <motion.div variants={fadeUpV} className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs tracking-[0.16em] text-white/30">
              {signals.map((signal) => <span key={signal}>{signal}</span>)}
              <span className="h-px w-10 bg-white/10" />
              <span>CONNECTED BY DESIGN</span>
            </motion.div>
          </motion.div>

          <motion.div
            variants={visualEntrance}
            initial="hidden"
            animate="visible"
            className="hero-glow relative mx-auto w-full max-w-[460px]"
          >
            <div className="pointer-events-none absolute -left-5 -right-5 -top-5 bottom-12 rounded-full border border-violet-300/10" />
            <div className="orbit pointer-events-none absolute -left-9 -right-9 -top-1 bottom-4 rounded-full border border-cyan-300/10 border-dashed" />
            <div className="orbit-reverse pointer-events-none absolute -left-2 -right-2 -top-9 bottom-20 rounded-full border border-violet-300/10" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#090c12]/90 shadow-2xl shadow-black/40 backdrop-blur-2xl">
              <div aria-hidden="true" className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-cyan-300" />
                  <span className="text-xs font-medium text-white/65">REPLYFLOW OS · PIPELINE</span>
                </div>
                <span className="text-[10px] tracking-widest text-white/25">LIVE</span>
              </div>

              <div className="px-5 pb-5 pt-4">
                {pipeline.map((item, i) => (
                  <div key={item.label}>
                    {i > 0 && (
                      <div aria-hidden="true" className="relative ml-[17px] h-5 w-px bg-white/10">
                        <span
                          className={`pipeline-flow ${item.ai ? "pipeline-flow-ai" : ""} absolute -left-[3.5px] top-0 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.55)]`}
                          style={{ animationDelay: `${(i * 0.45).toFixed(2)}s` }}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3.5 py-2.5">
                      <span className="font-mono text-[10px] tabular-nums text-white/25">{item.step}</span>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dot} ${item.pulse ? "pulse-dot" : ""}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white/85">{item.label}</p>
                        <p className="truncate text-[11px] text-white/35">{item.detail}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] tracking-wider ${item.chip}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}

                <div className="mt-4 rounded-2xl border border-white/8 bg-gradient-to-r from-violet-400/[0.08] to-cyan-300/[0.05] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">AUTOMATION HEALTH</span>
                    <span className="text-xs text-cyan-300">98.4%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "98.4%" }}
                      transition={reduceMotion ? { duration: 0 } : { delay: 1.1, duration: 1.1, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-300 to-cyan-300"
                    />
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -left-1 top-16 hidden rounded-2xl border border-white/10 bg-[#0b0f16]/90 px-4 py-3 shadow-2xl backdrop-blur-xl sm:block"
            >
              <p className="text-[10px] tracking-wider text-white/30">NEW LEAD</p>
              <p className="mt-1 text-sm text-white/80">+1 qualified</p>
            </motion.div>

            <motion.div
              animate={reduceMotion ? undefined : { y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              className="absolute -right-1 bottom-16 hidden rounded-2xl border border-cyan-300/10 bg-[#0b0f16]/90 px-4 py-3 shadow-2xl backdrop-blur-xl sm:block"
            >
              <p className="text-[10px] tracking-wider text-cyan-300/60">FOLLOW-UP</p>
              <p className="mt-1 text-sm text-white/80">Sent automatically</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
