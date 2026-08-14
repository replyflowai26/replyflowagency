"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { services, type Service } from "@/data/services"

function ServiceDetail({
  service,
  onClose,
}: {
  service: Service
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl"
    >
      <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="mb-5 flex items-center justify-between gap-4">
            <span className="text-sm font-medium tracking-[0.18em] text-cyan-300">
              {service.number} / SYSTEM
            </span>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </div>

          <h3 className="max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
            {service.title}
          </h3>

          <p className="mt-5 max-w-2xl text-base leading-7 text-white/60 md:text-lg">
            {service.detail}
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">
                The problem
              </p>
              <p className="mt-3 text-sm leading-6 text-white/60">
                {service.description}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">
                The outcome
              </p>
              <p className="mt-3 text-sm leading-6 text-white/60">
                {service.detail}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">
            Automation flow
          </p>

          <div className="mt-6 space-y-3">
            {service.steps.map((step, index) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.35,
                  delay: index * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 text-xs text-cyan-300">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="text-sm font-medium text-white/80">
                  {step}
                </span>
              </motion.div>
            ))}
          </div>

          <a
            href="#contact"
            onClick={onClose}
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Automate this workflow
          </a>
        </div>
      </div>
    </motion.div>
  )
}

export function ServiceExperience() {
  const [selected, setSelected] = useState<string | null>(null)

  const selectedService =
    services.find((service) => service.id === selected) ?? null

  return (
    <section id="services" className="border-t border-white/10 py-24 md:py-32">
      <div className="container">
        <div className="max-w-3xl">
          <p className="text-sm font-medium tracking-[0.18em] text-cyan-300">
            WHAT WE AUTOMATE
          </p>

          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Systems that remove repetitive work.
          </h2>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/55 md:text-lg">
            Explore how ReplyFlow AI can connect AI, data and business tools
            into measurable operational workflows.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {services.map((service, index) => {
            const isSelected = selected === service.id

            return (
              <motion.button
                key={service.id}
                type="button"
                onClick={() =>
                  setSelected(isSelected ? null : service.id)
                }
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.45,
                  delay: index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.99 }}
                className={`group text-left rounded-3xl border p-6 transition-colors md:p-8 ${
                  isSelected
                    ? "border-cyan-300/30 bg-cyan-300/[0.05]"
                    : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]"
                }`}
              >
                <div className="flex items-start justify-between gap-6">
                  <span className="text-sm text-white/35">
                    {service.number}
                  </span>

                  <motion.span
                    animate={{ rotate: isSelected ? 45 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-2xl font-light text-white/50"
                  >
                    +
                  </motion.span>
                </div>

                <h3 className="mt-12 text-xl font-semibold text-white md:text-2xl">
                  {service.title}
                </h3>

                <p className="mt-3 max-w-md text-sm leading-6 text-white/55">
                  {service.description}
                </p>

                <span className="mt-6 inline-block text-xs font-medium uppercase tracking-[0.14em] text-cyan-300/80">
                  {isSelected ? "Viewing system" : "Explore system"}
                </span>
              </motion.button>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          {selectedService && (
            <ServiceDetail
              key={selectedService.id}
              service={selectedService}
              onClose={() => setSelected(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
