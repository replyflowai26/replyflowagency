"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Sidebar } from "./sidebar"

type MobileNavProps = {
  open: boolean
  organizationName: string | null
  onClose: () => void
}

export function MobileNav({ open, organizationName, onClose }: MobileNavProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const active = document.activeElement as HTMLElement | null
        if (active && !active.closest("[data-mobile-nav]")) {
          const first = document.querySelector<HTMLElement>(
            "[data-mobile-nav] a, [data-mobile-nav] button",
          )
          first?.focus()
        }
      }
    }
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <motion.button
            type="button"
            aria-label="Close navigation menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            data-mobile-nav
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw]"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <Sidebar
              organizationName={organizationName}
              onNavigate={onClose}
            />
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
