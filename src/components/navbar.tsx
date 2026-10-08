"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { siteConfig } from "@/config/site"

const links = [
  { href: "#services", label: "Systems" },
  { href: "#process", label: "Process" },
  { href: "#contact", label: "Contact" },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-2 sm:px-0">
      <div className="container pt-3 sm:pt-4">
        <nav
          data-scrolled={scrolled ? "true" : "false"}
          className="navbar-surface flex items-center justify-between gap-4 rounded-2xl py-2.5 pl-4 pr-2.5 sm:py-3 sm:pl-5 sm:pr-3"
        >
          <a href="#" className="group flex items-center gap-2.5" aria-label="ReplyFlow AI home">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 transition-colors duration-[var(--dur-fast)] group-hover:border-cyan-300/45">
              <span className="pulse-dot h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-white/90 transition-colors duration-[var(--dur-fast)] group-hover:text-white">
              {siteConfig.name}
            </span>
          </a>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm text-white/55 transition-colors duration-[var(--dur-fast)] hover:bg-white/[0.05] hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          <motion.a
            href="#contact"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.08)] transition-colors duration-[var(--dur-fast)] hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70"
          >
            Book a call
          </motion.a>
        </nav>
      </div>
    </header>
  )
}
