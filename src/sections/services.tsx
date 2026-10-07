"use client"

import { motion, useReducedMotion } from "motion/react"
import { useState } from "react"
import { services, type Service } from "@/data/services"
import { ServiceDetail } from "@/components/service-detail"
import { staggerContainer, staggerContainerInstant, fadeUp, fadeUpInstant, cardViewport } from "@/lib/motion"

export function Services() {
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const reduceMotion = useReducedMotion()
  const stagger = reduceMotion ? staggerContainerInstant : staggerContainer
  const fadeUpV = reduceMotion ? fadeUpInstant : fadeUp

  return (
    <>
      <section id="services" className="services-section relative overflow-hidden py-28 sm:py-36">
        <div className="services-network absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="container relative">
          <motion.div
            variants={fadeUpV}
            initial="hidden"
            whileInView="visible"
            viewport={cardViewport}
            className="max-w-3xl"
          >
            <p className="text-sm font-medium tracking-[0.2em] text-cyan-300">WHAT WE BUILD</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-6xl">
              One automation layer for the work that slows you down.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
              Modular systems that connect your people, data and tools into one reliable operating flow.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={cardViewport}
            className="mt-14 grid gap-4 md:grid-cols-2"
          >
            {services.map((service) => (
              <motion.button
                key={service.id}
                type="button"
                onClick={() => setSelectedService(service)}
                variants={fadeUpV}
                whileHover={reduceMotion ? {} : { y: -5 }}
                whileTap={reduceMotion ? {} : { scale: 0.99 }}
                className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#080b10]/75 p-7 text-left shadow-2xl shadow-black/10 backdrop-blur-xl transition-colors hover:border-cyan-300/20 hover:bg-[#0b1017]/90 sm:p-8"
              >
                <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-cyan-300/[0.05] blur-3xl transition-opacity group-hover:opacity-100" />
                <div className="relative flex min-h-52 flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-mono text-xs tracking-widest text-white/25">{service.number}</span>
                    <span className="text-xs tracking-wider text-white/25 transition-colors group-hover:text-cyan-300">EXPLORE <span className="inline-block transition-transform group-hover:translate-x-1">→</span></span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-white">{service.title}</h3>
                    <p className="mt-3 max-w-md text-base leading-7 text-white/45">{service.description}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </section>

      <ServiceDetail service={selectedService} onClose={() => setSelectedService(null)} />
    </>
  )
}