"use client"

import { motion } from "motion/react"
import { useState } from "react"
import { services, type Service } from "@/data/services"
import { ServiceDetail } from "@/components/service-detail"

export function Services() {
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  return (
    <>
      <section id="services" className="relative overflow-hidden py-28 sm:py-36">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65 }}
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

          <div className="mt-14 grid gap-4 md:grid-cols-2">
            {services.map((service, index) => (
              <motion.button
                key={service.id}
                type="button"
                onClick={() => setSelectedService(service)}
                className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-7 text-left transition-colors hover:border-cyan-300/20 hover:bg-white/[0.045] sm:p-8"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.18 }}
                transition={{ duration: 0.5, delay: index * 0.07 }}
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.99 }}
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
          </div>
        </div>
      </section>

      <ServiceDetail service={selectedService} onClose={() => setSelectedService(null)} />
    </>
  )
}
