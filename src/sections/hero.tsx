"use client"

import { motion } from "motion/react"

const signals = ["LEADS", "SALES", "SUPPORT", "OPS"]

export function Hero() {
  return (
    <section className="grid-bg relative flex min-h-[760px] items-center overflow-hidden pt-28 sm:min-h-screen">
      <div className="pointer-events-none absolute left-1/2 top-[12%] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-violet-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-8rem] top-[28%] h-72 w-72 rounded-full bg-cyan-400/10 blur-[100px]" />

      <div className="container relative py-20 sm:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 max-w-3xl"
          >
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-2 text-sm text-white/70"
            >
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan-300" />
              AI automation for ambitious businesses
            </motion.div>

            <h1 className="text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-7xl lg:text-[5.4rem]">
              Stop doing manually
              <span className="block text-gradient">what AI can run.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-white/55 sm:text-lg sm:leading-8">
              ReplyFlow AI designs connected automation systems for lead generation,
              sales, customer support and operations — so your team can focus on growth.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <motion.a
                href="#contact"
                whileHover={{ y: -2, scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="rounded-xl bg-white px-6 py-3.5 text-center font-semibold text-black shadow-[0_0_40px_rgba(255,255,255,.08)]"
              >
                Build my automation <span className="ml-1">→</span>
              </motion.a>
              <motion.a
                href="#services"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                className="glass rounded-xl px-6 py-3.5 text-center font-semibold text-white/85 transition hover:border-cyan-300/20"
              >
                Explore systems
              </motion.a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs tracking-[0.16em] text-white/25">
              {signals.map((signal) => <span key={signal}>{signal}</span>)}
              <span className="h-px w-10 bg-white/10" />
              <span>CONNECTED BY DESIGN</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 1, ease: "easeOut" }}
            className="hero-glow relative mx-auto h-[360px] w-full max-w-[480px] sm:h-[430px]"
          >
            <div className="absolute inset-10 rounded-full border border-violet-300/10" />
            <div className="orbit absolute inset-4 rounded-full border border-cyan-300/10 border-dashed" />
            <div className="orbit-reverse absolute inset-16 rounded-full border border-violet-300/10" />

            <div className="absolute left-1/2 top-1/2 w-[86%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[2rem] border border-white/10 bg-[#090c12]/90 shadow-2xl shadow-black/40 backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-cyan-300" />
                  <span className="text-xs font-medium text-white/65">REPLYFLOW OS</span>
                </div>
                <span className="text-[10px] tracking-widest text-white/25">LIVE</span>
              </div>

              <div className="relative p-5">
                <div className="scan-line absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Lead intake", "Connected", "bg-cyan-300"],
                    ["Qualification", "AI running", "bg-violet-300"],
                    ["Follow-up", "Automated", "bg-cyan-300"],
                    ["Reporting", "Synced", "bg-violet-300"],
                  ].map(([label, value, dot]) => (
                    <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-white/30">{label}</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                      </div>
                      <p className="mt-5 text-sm font-medium text-white/80">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl border border-white/8 bg-gradient-to-r from-violet-400/[0.08] to-cyan-300/[0.05] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">AUTOMATION HEALTH</span>
                    <span className="text-xs text-cyan-300">98.4%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "98.4%" }}
                      transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-300 to-cyan-300"
                    />
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -left-1 top-16 hidden rounded-2xl border border-white/10 bg-[#0b0f16]/90 px-4 py-3 shadow-2xl backdrop-blur-xl sm:block"
            >
              <p className="text-[10px] tracking-wider text-white/30">NEW LEAD</p>
              <p className="mt-1 text-sm text-white/80">+1 qualified</p>
            </motion.div>

            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              className="absolute -right-1 bottom-16 hidden rounded-2xl border border-cyan-300/10 bg-[#0b0f16]/90 px-4 py-3 shadow-2xl backdrop-blur-xl sm:block"
            >
              <p className="text-[10px] tracking-wider text-cyan-300/60">WORKFLOW</p>
              <p className="mt-1 text-sm text-white/80">Running automatically</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
