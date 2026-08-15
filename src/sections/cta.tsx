"use client"

import { motion } from "motion/react"
import { siteConfig } from "@/config/site"

export function CTA() {
  return (
    <motion.section
      id="contact"
      className="relative overflow-hidden py-28 sm:py-36"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7 }}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-[110px]" />
      <div className="container relative">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.035] to-cyan-300/[0.025] p-8 shadow-2xl sm:p-14 lg:p-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-1.5 text-xs tracking-[0.15em] text-cyan-300">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan-300" />
                READY WHEN YOU ARE
              </div>
              <h2 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
                Let&apos;s automate the work your team shouldn&apos;t be doing manually.
              </h2>
              <p className="mt-7 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                Tell us what is repetitive, slow or leaking revenue. We&apos;ll map the system before recommending a build.
              </p>
            </div>

            <motion.a
              href={`mailto:${siteConfig.email}`}
              whileHover={{ y: -3, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black shadow-[0_12px_50px_rgba(255,255,255,.08)]"
            >
              Start a conversation <span className="ml-2">↗</span>
            </motion.a>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
