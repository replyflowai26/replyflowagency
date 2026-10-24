"use client"

import { motion, useReducedMotion } from "motion/react"
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
} from "@/lib/motion"

const SPINE =
  "M85,74 H215 V180 H85 V286 H215"

// Spine geometry: five segments of 130/106/130/106/130 units (total 602).
// Cumulative distance to each node maps to a fraction of the 8.4s signal
// travel, so each node lights exactly as the signal arrives (t=0, 1.81, 3.29,
// 5.11, 6.59, ~8.1s). Delays are negative so the loop is already in phase.
const SEGMENT_STARTS = [0, 1.81, 3.29, 5.11, 6.59]
const NODE_ARRIVALS = [0, 1.81, 3.29, 5.11, 6.59, 8.1]

const nodes = [
  { num: "01", label: "Lead Capture", meta: "Web · WhatsApp · Email", x: 85, y: 74 },
  { num: "02", label: "Qualification", meta: "Score + route", x: 215, y: 74 },
  { num: "03", label: "AI Follow-up", meta: "Sequenced sends", x: 215, y: 180 },
  { num: "04", label: "Booking", meta: "Cal + confirm", x: 85, y: 180 },
  { num: "05", label: "CRM", meta: "Auto sync", x: 85, y: 286 },
  { num: "06", label: "Reporting", meta: "Live metrics", x: 215, y: 286 },
]

const rail = ["LEAD", "QUALIFY", "FOLLOW-UP", "BOOKING", "CRM", "REPORT"]

// Each knot's lit window (~1.2s, starting at 1% of the cycle) is phase-shifted
// so it contains the moment the signal reaches that node: delay = -(8.4 - (t - .08)).
const ringDelay = NODE_ARRIVALS.map((t) => `-${(8.4 - Math.max(0, t - 0.08)).toFixed(2)}s`)

export function Hero() {
  const reduceMotion = useReducedMotion()
  return (
    <section className="grid-bg relative flex min-h-[660px] items-center overflow-hidden pt-24 sm:pt-28">
      <div className="hero-depth print-halftone absolute inset-0" aria-hidden="true">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1120px_560px_at_14%_-6%,rgba(77,108,238,0.24),transparent_62%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-[radial-gradient(720px_220px_at_50%_118%,rgba(58,111,216,0.16),transparent_72%)]" />
        <div className="hero-vignette pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute left-[7%] top-[16%] h-px w-36 bg-[--warm]/70" />
      </div>

      <div className="container relative py-10 sm:py-12">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.06fr] lg:gap-8">
          <motion.div
            variants={reduceMotion ? staggerContainerInstant : staggerContainer}
            initial="hidden"
            animate="visible"
            className="relative z-10"
          >
            <motion.div
              variants={reduceMotion ? fadeFromLeftInstant : fadeFromLeft}
              className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-sm text-white/80 backdrop-blur-md"
            >
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[--blue]" />
              The operating layer for client-facing businesses
            </motion.div>

            <motion.h1
              variants={reduceMotion ? fadeUpLargeInstant : fadeUpLarge}
              className="font-display text-[2.8rem] font-semibold leading-[1.02] text-white sm:text-6xl lg:text-7xl"
            >
              Operating systems for the business&nbsp;that
              <span className="text-gradient italic"> answers, books and grows itself.</span>
              <span className="headline-glint" />
            </motion.h1>

            <motion.p variants={reduceMotion ? fadeUpInstant : fadeUp} className="mt-7 max-w-xl text-base leading-7 text-white/60 sm:text-lg sm:leading-8">
              ReplyFlow connects lead capture, qualification, follow-up,
              booking, CRM and reporting into one continuous loop — so your
              team does the judgment work and the system does everything else.
            </motion.p>

            <motion.div variants={reduceMotion ? fadeUpInstant : fadeUp} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <motion.a
                href="#contact"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="print-flat rounded-xl px-6 py-3.5 text-center font-semibold text-ink transition-[background-color,box-shadow] duration-[var(--dur-fast)] hover:bg-paper-lift hover:shadow-[0_12px_28px_rgba(2,6,14,0.24)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--blue-ink]"
              >
                Build my automation <span className="ml-1" aria-hidden="true">→</span>
              </motion.a>
              <motion.a
                href="#services"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="rounded-xl border border-white/20 bg-white/[0.04] px-6 py-3.5 text-center font-semibold text-white/85 transition-colors duration-[var(--dur-fast)] hover:border-white/40 hover:bg-white/[0.07] active:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--blue]"
              >
                Browse the systems
              </motion.a>
            </motion.div>

            <motion.div variants={reduceMotion ? fadeUpInstant : fadeUp} className="mt-10 flex flex-wrap items-center gap-x-0 font-mono text-[11px] tracking-[0.12em] text-white/55">
              {rail.map((step, index) => (
                <span key={step} className="flex items-center">
                  {index > 0 && <span className="mx-2 h-px w-4 bg-white/25" aria-hidden="true" />}
                  <span className="text-white/85">{step}</span>
                </span>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.9, ease: EASE, delay: 0.35 }}
            className="relative z-10 mx-auto w-full"
          >
            <div className="relative mx-auto max-w-[620px]">
              <div className="print-flat relative overflow-hidden rounded-[1.75rem] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_32px_84px_rgba(2,4,10,0.55)] ring-1 ring-white/[0.06] sm:p-4">
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-blue-ink/40 to-transparent" />
                <div className="mb-3 flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-ink-muted">
                  <span>OPERATING PLATE</span>
                  <span>6 SYSTEMS · ONE LOOP</span>
                </div>

                <div className="canvas-plane canvas-drift-a pointer-events-none absolute inset-0 -z-10 opacity-70" aria-hidden="true">
                  <svg viewBox="0 0 600 360" fill="none" className="h-full w-full">
                    <path d="M16 330 H584 M16 30 H584 M16 180 H584" stroke="rgba(31,92,197,0.09)" strokeWidth="1" />
                    {[
                      "M-40,110 C120,90 300,150 640,96",
                      "M-40,260 C140,240 340,300 640,250",
                    ].map((d) => (
                      <path key={d} d={d} stroke="rgba(31,92,197,0.08)" strokeWidth="1" strokeDasharray="2 7" />
                    ))}
                  </svg>
                </div>

                <div className="relative aspect-[600/360]">
                  <svg viewBox="0 0 600 360" fill="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
                    <path d={SPINE} stroke="rgba(31,92,197,0.32)" strokeWidth="1.6" strokeLinecap="round" />
                    {["M85,74 H215", "M215,74 V180", "M215,180 H85", "M85,180 V286", "M85,286 H215"].map((d, i) => (
                      <path key={d} d={d} className="link-dash-ink" stroke="#1f5cc5" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" style={{ animationDelay: `-${SEGMENT_STARTS[i]}s` }} />
                    ))}
                    <g className="signal-marble">
                      <circle r="13" fill="rgba(31,92,197,0.18)">
                        <animateMotion dur="8.4s" repeatCount="indefinite" path={SPINE} begin="0s" />
                      </circle>
                      <circle r="4.2" fill="#1f5cc5">
                        <animateMotion dur="8.4s" repeatCount="indefinite" path={SPINE} begin="0s" />
                      </circle>
                    </g>
                    <g className="signal-marble" style={{ opacity: 0.5 }}>
                      <circle r="2.6" fill="#3a6fd8">
                        <animateMotion dur="8.4s" repeatCount="indefinite" path={SPINE} begin="-0.4s" />
                      </circle>
                    </g>
                    <g className="signal-marble" style={{ opacity: 0.26 }}>
                      <circle r="1.8" fill="#3a6fd8">
                        <animateMotion dur="8.4s" repeatCount="indefinite" path={SPINE} begin="-0.8s" />
                      </circle>
                    </g>
                  </svg>

                  {nodes.map((node, index) => (
                    <div
                      key={node.num}
                      className="tile-beam absolute w-[120px] sm:w-[150px]"
                      style={{
                        left: `${(node.x - 62) / 6}%`,
                        top: `${(node.y - 19) / 3.6}%`,
                      }}
                    >
                      <div className="plate-tile fragment-settle relative rounded-xl px-3 py-2.5 sm:px-4 sm:py-3" style={{ animationDelay: `${0.5 + index * 0.12}s` }}>
                        <span className="node-ring" aria-hidden="true" style={{ animationDelay: ringDelay[index] }} />
                        <span className="node-glow" aria-hidden="true" style={{ animationDelay: ringDelay[index] }} />
                        <p className="font-mono text-[9px] tracking-[0.18em] text-blue-ink">{node.num}</p>
                        <p className="mt-0.5 text-[11px] font-semibold leading-tight text-ink sm:text-xs">{node.label}</p>
                        <p className="mt-1 hidden font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted sm:block">{node.meta}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fragment-float-a absolute -left-2 top-[4%] hidden rounded-lg border border-line-ink bg-paper-lift px-3.5 py-2.5 shadow-[0_14px_34px_rgba(4,8,18,0.24)] lg:block">
                <p className="font-mono text-[9px] tracking-[0.16em] text-blue-ink">STATUS</p>
                <p className="mt-0.5 text-sm text-ink">A cold lead warmed by one system</p>
              </div>
              <div className="fragment-float-b absolute -right-2 bottom-[6%] hidden rounded-lg border border-line-ink bg-paper-lift px-3.5 py-2.5 shadow-[0_14px_34px_rgba(4,8,18,0.24)] lg:block">
                <p className="font-mono text-[9px] tracking-[0.16em] text-blue-ink">OUTPUT</p>
                <p className="mt-0.5 text-sm text-ink">A signed meeting on your calendar</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}