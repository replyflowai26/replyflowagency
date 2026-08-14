"use client"

import { motion } from "motion/react"
import { useState } from "react"
import { services, type Service } from "@/data/services"
import { ServiceDetail } from "@/components/service-detail"

export function Services() {
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  return (
    <>
      <section id="services" className="py-28">
        <div className="container">
          <p className="text-sm font-medium tracking-[0.18em] text-cyan-300">
            WHAT WE BUILD
          </p>

          <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            One automation layer for the work that slows you down.
          </h2>

          <div className="mt-14 grid gap-4 md:grid-cols-2">
            {services.map((service, index) => (
              <motion.button
                key={service.id}
                type="button"
                onClick={() => setSelectedService(service)}
                className="group rounded-3xl border border-white/10 bg-white/[0.025] p-7 text-left transition-colors hover:border-cyan-300/20 hover:bg-white/[0.045]"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.45,
                  delay: index * 0.06,
                }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="text-sm text-white/30">
                    {service.number}
                  </span>

                  <span className="text-xs text-white/30 transition-colors group-hover:text-cyan-300">
                    EXPLORE →
                  </span>
                </div>

                <h3 className="mt-12 text-2xl font-semibold text-white">
                  {service.title}
                </h3>

                <p className="mt-3 max-w-md text-base leading-7 text-white/55">
                  {service.description}
                </p>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <ServiceDetail
        service={selectedService}
        onClose={() => setSelectedService(null)}
      />
    </>
  )
}
