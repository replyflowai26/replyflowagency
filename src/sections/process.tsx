"use client"

import { motion, useInView, useReducedMotion, useScroll } from "motion/react"
import { useRef } from "react"
import { fadeUp, cardViewport } from "@/lib/motion"

const steps = [
  ["01", "Audit", "Map the manual work and bottlenecks."],
  ["02", "Design", "Design the automation architecture."],
  ["03", "Build", "Connect AI, data and business tools."],
  ["04", "Optimize", "Measure, improve and scale the system."],
]

function ProcessStep({ number, title, description }: { number: string; title: string; description: string }) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLElement | null>(null)
  const inView = useInView(ref, { amount: 0.6 })

  return (
    <motion.article
      ref={ref}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={cardViewport}
      className={[
        "group relative rounded-3xl border p-6 transition-colors duration-300 sm:ml-8 sm:p-7",
        inView
          ? "border-cyan-300/30 bg-white/[0.05]"
          : "border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]",
      ].join(" ")}
    >
      <motion.div
        className="absolute -left-[41px] top-8 hidden h-3 w-3 rounded-full border border-cyan-300/40 bg-[#05070b] sm:block"
        animate={reduceMotion ? undefined : { scale: inView ? 1.35 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        style={inView ? { boxShadow: "0 0 22px rgba(103, 232, 249, 0.55)", borderColor: "rgba(103, 232, 249, 0.85)" } : undefined}
      />
      <div className="flex gap-5">
        <span className="font-mono text-xs tracking-widest text-white/25">{number}</span>
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/45">{description}</p>
        </div>
      </div>
    </motion.article>
  )
}

export function Process() {
  const reduceMotion = useReducedMotion()
  const stepsRef = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({ target: stepsRef, offset: ["start 0.8", "end 0.45"] })

  return (
    <section id="process" className="border-y border-white/10 bg-white/[0.012] py-28 sm:py-36">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <motion.div
            variants={fadeUp}
            initial={reduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={cardViewport}
          >
            <p className="text-sm font-medium tracking-[0.2em] text-violet-300">OUR PROCESS</p>
            <h2 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
              Built like a system, not a collection of hacks.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-white/45">
              Every automation starts with the business outcome, then gets designed, connected and measured.
            </p>
          </motion.div>

          <div ref={stepsRef} className="relative">
            <div className="absolute bottom-8 left-[15px] top-8 hidden w-px bg-gradient-to-b from-cyan-300/40 via-violet-300/20 to-transparent sm:block" />
            {!reduceMotion && (
              <motion.div
                className="absolute bottom-8 left-[15px] top-8 hidden w-px origin-top bg-gradient-to-b from-cyan-300/80 via-violet-300/50 to-cyan-300/20 sm:block"
                style={{ scaleY: scrollYProgress }}
              />
            )}
            <div className="space-y-4">
              {steps.map(([number, title, description]) => (
                <ProcessStep key={number} number={number} title={title} description={description} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}