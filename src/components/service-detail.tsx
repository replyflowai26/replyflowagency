"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"
import type { Service } from "@/data/services"
import { ServiceWorkflow } from "@/components/service-workflow"

type ServiceDetailProps = {
  service: Service | null
  onClose: () => void
}

export function ServiceDetail({
  service,
  onClose,
}: ServiceDetailProps) {
  const reduceMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!service) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKeyDown)

    const frame = requestAnimationFrame(() => dialogRef.current?.focus())

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
      cancelAnimationFrame(frame)
    }
  }, [service, onClose])

  return (
    <AnimatePresence>
      {service && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-title"
            tabIndex={-1}
            className="relative my-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d0f13] shadow-2xl outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300/70"
            initial={{
              opacity: 0,
              y: reduceMotion ? 0 : 30,
              scale: reduceMotion ? 1 : 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: reduceMotion ? 0 : 20,
              scale: reduceMotion ? 1 : 0.97,
            }}
            transition={{
              duration: reduceMotion ? 0 : 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.16),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(34,211,238,0.10),transparent_32%)]" />

            <div className="relative p-6 sm:p-10">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-medium tracking-[0.2em] text-blue-300">
                    {service.number} / SYSTEM
                  </p>

                  <motion.h2
                    id="service-title"
                    className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl"
                    initial={{
                      opacity: 0,
                      y: 12,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
transition={{
                      delay: reduceMotion ? 0 : 0.1,
                      duration: reduceMotion ? 0 : undefined,
                    }}
                  >
                    {service.title}
                  </motion.h2>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close service experience"
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  Close
                </button>
              </div>

              <motion.p
                className="mt-6 max-w-3xl text-base leading-7 text-white/60 sm:text-lg"
                initial={{
                  opacity: 0,
                  y: 12,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
transition={{
                    delay: reduceMotion ? 0 : 0.18,
                    duration: reduceMotion ? 0 : undefined,
                  }}
              >
                {service.detail}
              </motion.p>

              <ServiceWorkflow steps={service.steps} />

              <motion.div
                className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-7 sm:flex-row sm:items-center sm:justify-between"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
transition={{
                    delay: reduceMotion ? 0 : 0.5,
                    duration: reduceMotion ? 0 : undefined,
                  }}
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    Ready to automate this workflow?
                  </p>

                  <p className="mt-1 text-sm text-white/60">
                    We map the system before recommending the build.
                  </p>
                </div>

                <a
                  href="#contact"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Start a conversation
                </a>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
