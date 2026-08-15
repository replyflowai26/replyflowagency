"use client"

import { motion } from "motion/react"

const steps = [
  ["01", "Audit", "Map the manual work and bottlenecks."],
  ["02", "Design", "Design the automation architecture."],
  ["03", "Build", "Connect AI, data and business tools."],
  ["04", "Optimize", "Measure, improve and scale the system."],
]

export function Process() {
  return (
    <section id="process" className="border-y border-white/10 bg-white/[0.012] py-28 sm:py-36">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65 }}
          >
            <p className="text-sm font-medium tracking-[0.2em] text-violet-300">OUR PROCESS</p>
            <h2 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
              Built like a system, not a collection of hacks.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-white/45">
              Every automation starts with the business outcome, then gets designed, connected and measured.
            </p>
          </motion.div>

          <div className="relative">
            <div className="absolute bottom-8 left-[15px] top-8 hidden w-px bg-gradient-to-b from-cyan-300/40 via-violet-300/20 to-transparent sm:block" />
            <div className="space-y-4">
              {steps.map(([number, title, description], index) => (
                <motion.article
                  key={number}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.55, delay: index * 0.08 }}
                  className="group relative rounded-3xl border border-white/8 bg-white/[0.025] p-6 transition-colors hover:border-white/15 hover:bg-white/[0.04] sm:ml-8 sm:p-7"
                >
                  <div className="absolute -left-[41px] top-8 hidden h-3 w-3 rounded-full border border-cyan-300/40 bg-[#05070b] shadow-[0_0_20px_rgba(103,232,249,.15)] sm:block" />
                  <div className="flex gap-5">
                    <span className="font-mono text-xs tracking-widest text-white/25">{number}</span>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/45">{description}</p>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
