"use client"

import { motion } from "motion/react"
import { siteConfig } from "@/config/site"

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-2 sm:px-0">
      <div className="container pt-3 sm:pt-4">
        <nav className="glass flex items-center justify-between rounded-2xl px-4 py-3 sm:px-5">
          <a href="#" className="flex items-center gap-2.5" aria-label="ReplyFlow AI home">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10">
              <span className="pulse-dot h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span className="font-semibold tracking-tight">{siteConfig.name}</span>
          </a>

          <div className="hidden items-center gap-8 text-sm text-white/60 md:flex">
            <a className="transition hover:text-white" href="#services">Systems</a>
            <a className="transition hover:text-white" href="#process">Process</a>
            <a className="transition hover:text-white" href="#contact">Contact</a>
          </div>

          <motion.a
            href="#contact"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-white/5 transition hover:bg-cyan-50"
          >
            Book a call
          </motion.a>
        </nav>
      </div>
    </header>
  )
}
