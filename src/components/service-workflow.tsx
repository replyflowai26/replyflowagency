"use client"

import { motion } from "motion/react"
import { useEffect, useState } from "react"

type ServiceWorkflowProps = {
  steps: string[]
}

export function ServiceWorkflow({
  steps,
}: ServiceWorkflowProps) {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    if (steps.length <= 1) return

    const interval = window.setInterval(() => {
      setActiveStep((current) =>
        current >= steps.length - 1 ? 0 : current + 1
      )
    }, 1800)

    return () => window.clearInterval(interval)
  }, [steps.length])

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/35">
            Live workflow
          </p>

          <p className="mt-1 text-sm text-white/60">
            AI automation sequence
          </p>
        </div>

        <div className="flex items-center gap-2">
          <motion.span
            className="h-2 w-2 rounded-full bg-cyan-300"
            animate={{
              opacity: [0.35, 1, 0.35],
              scale: [0.8, 1.15, 0.8],
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
            }}
          />

          <span className="text-xs font-medium text-cyan-300/80">
            PROCESSING
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(139,92,246,0.12),transparent_30%),radial-gradient(circle_at_85%_70%,rgba(34,211,238,0.10),transparent_30%)]" />

        <div className="relative">
          <div className="hidden sm:block absolute left-[10%] right-[10%] top-6 h-px bg-white/10" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {steps.map((step, index) => {
              const isActive = index === activeStep
              const isComplete = index < activeStep

              return (
                <motion.div
                  key={step}
                  className="relative"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: index * 0.08,
                    duration: 0.35,
                  }}
                >
                  <div className="flex items-center gap-4 sm:block">
                    <motion.div
                      className={[
                        "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                        isActive
                          ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-300"
                          : isComplete
                            ? "border-white/20 bg-white/10 text-white"
                            : "border-white/10 bg-[#101217] text-white/35",
                      ].join(" ")}
                      animate={
                        isActive
                          ? {
                              scale: [1, 1.08, 1],
                              boxShadow: [
                                "0 0 0 rgba(34,211,238,0)",
                                "0 0 24px rgba(34,211,238,0.18)",
                                "0 0 0 rgba(34,211,238,0)",
                              ],
                            }
                          : {}
                      }
                      transition={{
                        duration: 1.4,
                        repeat: Infinity,
                      }}
                    >
                      {isComplete ? "✓" : `0${index + 1}`}
                    </motion.div>

                    <div className="sm:mt-4">
                      <p
                        className={[
                          "text-sm font-medium transition-colors",
                          isActive
                            ? "text-white"
                            : isComplete
                              ? "text-white/70"
                              : "text-white/40",
                        ].join(" ")}
                      >
                        {step}
                      </p>

                      <p className="mt-1 text-xs text-white/25">
                        {isActive
                          ? "AI processing"
                          : isComplete
                            ? "Completed"
                            : "Queued"}
                      </p>
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <div className="ml-6 mt-3 h-5 w-px bg-white/10 sm:hidden" />
                  )}
                </motion.div>
              )
            })}
          </div>

          <div className="mt-8 h-1 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full bg-cyan-300"
              animate={{
                width: `${((activeStep + 1) / steps.length) * 100}%`,
              }}
              transition={{
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
