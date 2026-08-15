"use client"

import Link from "next/link"
import { motion } from "motion/react"

interface AuthShellProps {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070b] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(124,58,237,.18),transparent_30rem),radial-gradient(circle_at_86%_78%,rgba(34,211,238,.12),transparent_30rem)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:56px_56px]" />

      <header className="relative z-20 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl sm:px-5">
          <Link href="/" className="flex items-center gap-3" aria-label="ReplyFlow AI home">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10">
              <span className="pulse-dot h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span className="font-semibold tracking-tight">ReplyFlow AI</span>
          </Link>
          <Link href="/" className="text-sm text-white/50 transition hover:text-white">Back to website</Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_480px] lg:px-8 lg:py-16">
        <motion.div initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .55 }} className="hidden lg:block">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-xs font-medium tracking-[.16em] text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            REPLYFLOW WORKSPACE
          </div>
          <h1 className="max-w-2xl text-6xl font-semibold leading-[1.02] tracking-[-.045em] xl:text-7xl">Build the operating system behind your <span className="text-gradient">business.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/50">One secure workspace for clients, automations, team access and the systems that keep your operations moving.</p>

          <div className="mt-10 grid max-w-xl grid-cols-2 gap-3">
            {[
              ["01", "Client systems", "Structured and connected"],
              ["02", "Automation", "Designed for scale"],
              ["03", "Team access", "Role-aware permissions"],
              ["04", "Operations", "One source of truth"],
            ].map(([number, label, detail], index) => (
              <motion.div key={number} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 + index * .06 }} className="rounded-2xl border border-white/8 bg-white/[.035] p-4 backdrop-blur-xl">
                <p className="text-[10px] tracking-[.2em] text-white/25">{number}</p>
                <p className="mt-5 text-sm font-medium text-white/85">{label}</p>
                <p className="mt-1 text-xs text-white/35">{detail}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, delay: .08 }} className="w-full">
          <div className="rounded-[2rem] border border-white/10 bg-[#0b0e14]/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,.5)] backdrop-blur-2xl sm:p-8">
            <div className="mb-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-300/10"><span className="h-2.5 w-2.5 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(196,181,253,.7)]" /></div>
              <p className="text-xs font-medium uppercase tracking-[.2em] text-cyan-300">{eyebrow}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">{description}</p>
            </div>
            {children}
          </div>
          {footer && <div className="mt-5 text-center">{footer}</div>}
        </motion.div>
      </section>
    </main>
  )
}
