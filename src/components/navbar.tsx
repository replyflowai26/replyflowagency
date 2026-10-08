"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { siteConfig } from "@/config/site"

const links = [
  { href: "#services", label: "Systems" },
  { href: "#process", label: "Process" },
  { href: "#contact", label: "Contact" },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Element)) { setMenuOpen(false); return }
      if (!target.closest("nav")) setMenuOpen(false)
    }
    const mql = window.matchMedia("(min-width: 768px)")
    const onBreakpoint = () => { if (mql.matches) setMenuOpen(false) }
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown)
    mql.addEventListener("change", onBreakpoint)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown)
      mql.removeEventListener("change", onBreakpoint)
    }
  }, [menuOpen])

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-2 sm:px-0">
      <div className="container pt-3 sm:pt-4">
        <nav
          data-scrolled={scrolled ? "true" : "false"}
          className="navbar-surface relative flex items-center justify-between gap-4 rounded-2xl py-2.5 pl-4 pr-2.5 sm:py-3 sm:pl-5 sm:pr-3"
        >
          <a href="#" className="group flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70" aria-label="ReplyFlow AI home">
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
                className="rounded-lg px-3 py-2 text-sm text-white/55 transition-colors duration-[var(--dur-fast)] hover:bg-white/[0.05] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70 transition-colors duration-[var(--dur-fast)] hover:border-cyan-300/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70 md:hidden"
            >
              <span className="relative block h-3.5 w-4" aria-hidden="true">
                <span
                  className={[
                    "absolute left-0 block h-px w-4 bg-current transition-all duration-200",
                    menuOpen ? "top-1.5 rotate-45" : "top-0",
                  ].join(" ")}
                />
                <span
                  className={[
                    "absolute left-0 top-1.5 block h-px w-4 bg-current transition-opacity duration-200",
                    menuOpen ? "opacity-0" : "opacity-100",
                  ].join(" ")}
                />
                <span
                  className={[
                    "absolute left-0 block h-px w-4 bg-current transition-all duration-200",
                    menuOpen ? "top-1.5 -rotate-45" : "top-3",
                  ].join(" ")}
                />
              </span>
            </button>

            <motion.a
              href="#contact"
              whileHover={reduceMotion ? {} : { y: -1 }}
              whileTap={reduceMotion ? {} : { scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.08)] transition-colors duration-[var(--dur-fast)] hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70"
            >
              Book a call
            </motion.a>
          </div>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                id="mobile-nav-menu"
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
                className="absolute inset-x-0 top-full z-50 mt-2 rounded-2xl border border-white/10 bg-[#0b0f16]/95 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden"
              >
                {links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-4 py-3 text-sm text-white/70 transition-colors duration-[var(--dur-fast)] hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70"
                  >
                    {link.label}
                  </a>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </div>
    </header>
  )
}
