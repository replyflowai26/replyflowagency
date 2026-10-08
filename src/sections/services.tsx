"use client"

import { motion, useReducedMotion } from "motion/react"
import { useState, type ReactElement, type SVGProps } from "react"
import { services, type Service } from "@/data/services"
import { ServiceDetail } from "@/components/service-detail"
import { staggerContainer, staggerContainerInstant, fadeUp, fadeUpInstant, cardViewport } from "@/lib/motion"

function LeadIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M3.5 4.5h13l-4.8 5.8v4.9L8.3 16.5v-6.2L3.5 4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
}

function SalesIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M3.5 15.5 8 11l3 2.8 5-5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M12.5 8h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function SupportIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M16.5 9.5c0 3-2.9 5.5-6.5 5.5-.9 0-1.8-.15-2.6-.42L4 16.5l1-2.6C4 12.9 3.5 11.3 3.5 9.5 3.5 6.5 6.4 4 10 4s6.5 2.5 6.5 5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7.3 9.5h.01M10 9.5h.01M12.7 9.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}

function OpsIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><circle cx="4.5" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" /><circle cx="15.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" /><circle cx="15.5" cy="15" r="2" stroke="currentColor" strokeWidth="1.5" /><path d="M6.5 9.2 13.6 5.8M6.5 10.8l7.1 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
}

function ReportIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M4 16v-3.5M8.7 16V8.5M13.3 16V5.5M17 16H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
}

function CustomIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><path d="M9 6h4.5A1.5 1.5 0 0 1 15 7.5V11M11 14H6.5A1.5 1.5 0 0 1 5 12.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
}

type Tier = "primary" | "secondary"
type CardVisual = "route" | "pipeline" | "reply" | "mesh" | "chart" | "slots"

type CardConfig = {
  area: string
  tier: Tier
  category: string
  status: string
  statusTone: string
  visual: CardVisual
  Icon: (props: SVGProps<SVGSVGElement>) => ReactElement
}

const cardConfig: Record<string, CardConfig> = {
  "lead-generation": {
    area: "sm:col-span-2 lg:col-span-4",
    tier: "primary",
    category: "ACQUISITION",
    status: "LIVE",
    statusTone: "bg-emerald-300",
    visual: "route",
    Icon: LeadIcon,
  },
  "sales-automation": {
    area: "lg:col-span-2",
    tier: "primary",
    category: "REVENUE",
    status: "ACTIVE",
    statusTone: "bg-cyan-300",
    visual: "pipeline",
    Icon: SalesIcon,
  },
  "customer-support": {
    area: "lg:col-span-2",
    tier: "secondary",
    category: "SUCCESS",
    status: "AI-ASSISTED",
    statusTone: "bg-violet-300",
    visual: "reply",
    Icon: SupportIcon,
  },
  "operations": {
    area: "lg:col-span-2",
    tier: "secondary",
    category: "BACK OFFICE",
    status: "AUTOMATED",
    statusTone: "bg-cyan-300",
    visual: "mesh",
    Icon: OpsIcon,
  },
  "reporting": {
    area: "lg:col-span-2",
    tier: "secondary",
    category: "SIGNALS",
    status: "SYNCED",
    statusTone: "bg-emerald-300",
    visual: "chart",
    Icon: ReportIcon,
  },
  "custom-ai-systems": {
    area: "sm:col-span-2 lg:col-span-6",
    tier: "secondary",
    category: "PLATFORM",
    status: "CONFIGURABLE",
    statusTone: "bg-violet-300",
    visual: "slots",
    Icon: CustomIcon,
  },
}

function MiniVisual({ kind }: { kind: CardVisual }) {
  if (kind === "route") {
    return (
      <span className="flex w-24 items-center gap-1.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-[3px] border border-white/25 bg-white/5 transition-colors duration-300 group-hover:border-cyan-300/70 group-hover:bg-cyan-300/25" />
        <span className="h-px flex-1 bg-white/15 transition-colors duration-300 group-hover:bg-cyan-300/50" />
        <span className="h-2.5 w-2.5 rounded-[3px] border border-white/25 bg-white/5 transition-colors duration-300 delay-100 group-hover:border-cyan-300/70 group-hover:bg-cyan-300/25" />
        <span className="h-px flex-1 bg-white/15 transition-colors duration-300 delay-100 group-hover:bg-cyan-300/50" />
        <span className="h-2.5 w-2.5 rounded-[3px] border border-white/25 bg-white/5 transition-colors duration-300 delay-200 group-hover:border-cyan-300/70 group-hover:bg-cyan-300/25" />
      </span>
    )
  }
  if (kind === "pipeline") {
    return (
      <span className="flex h-5 items-end gap-1.5" aria-hidden="true">
        <span className="h-2 w-1.5 rounded-sm bg-white/15 transition-colors duration-300 group-hover:bg-cyan-300/50" />
        <span className="h-3 w-1.5 rounded-sm bg-white/15 transition-colors duration-300 delay-75 group-hover:bg-cyan-300/50" />
        <span className="h-4 w-1.5 rounded-sm bg-white/15 transition-colors duration-300 delay-100 group-hover:bg-cyan-300/60" />
        <span className="h-5 w-1.5 rounded-sm bg-white/15 transition-colors duration-300 delay-150 group-hover:bg-cyan-300/70" />
        <span className="h-5 w-1.5 rounded-sm bg-white/25 transition-colors duration-300 delay-200 group-hover:bg-cyan-300/90" />
      </span>
    )
  }
  if (kind === "reply") {
    return (
      <span className="flex h-5 items-end gap-1.5" aria-hidden="true">
        <span className="h-4 w-6 rounded-md rounded-br-sm border border-white/25 bg-white/5 transition-colors duration-300 group-hover:border-cyan-300/50" />
        <span className="h-3.5 w-5 rounded-md rounded-tl-sm border border-white/15 bg-white/[0.03] transition-colors duration-300 delay-100 group-hover:border-violet-300/60" />
      </span>
    )
  }
  if (kind === "mesh") {
    return (
      <svg viewBox="0 0 64 20" fill="none" className="h-5 w-24 text-white/25 transition-colors duration-300 group-hover:text-cyan-300/70" aria-hidden="true">
        <path d="M10 10h20M34 10h20M32 7.5 10.5 9M32 12.5 53.5 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="32" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="57" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    )
  }
  if (kind === "chart") {
    return (
      <svg viewBox="0 0 64 20" fill="none" className="h-5 w-24 text-white/25 transition-colors duration-300 group-hover:text-cyan-300/70" aria-hidden="true">
        <path d="M3 16l12-5 10 2 14-7 10 3 12-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="61" cy="2" r="2" fill="currentColor" />
      </svg>
    )
  }
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      <span className="h-3.5 w-3.5 rounded-[4px] border border-white/15 bg-white/5 transition-colors duration-300 group-hover:border-cyan-300/40" />
      <span className="h-3.5 w-3.5 rounded-[4px] border border-cyan-300/60 bg-cyan-300/15 transition-colors duration-300 group-hover:bg-cyan-300/30" />
      <span className="h-3.5 w-3.5 rounded-[4px] border border-white/15 bg-white/5 transition-colors duration-300 delay-100 group-hover:border-cyan-300/40" />
      <span className="h-3.5 w-3.5 rounded-[4px] border border-white/15 bg-white/5 transition-colors duration-300 delay-200 group-hover:border-cyan-300/40" />
    </span>
  )
}

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
            className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
          >
            {services.map((service) => {
              const cfg = cardConfig[service.id]!
              const primary = cfg.tier === "primary"
              const wide = cfg.category === "PLATFORM"

              const textBlock = (
                <div>
                  <h3
                    className={[
                      "font-semibold tracking-tight text-white",
                      primary ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
                    ].join(" ")}
                  >
                    {service.title}
                  </h3>
                  <p
                    className={[
                      "mt-3 text-base leading-7 text-white/45",
                      primary ? "max-w-md" : "max-w-sm",
                      wide ? "sm:max-w-lg" : "",
                    ].join(" ")}
                  >
                    {service.description}
                  </p>
                </div>
              )

              const statusBlock = (
                <div className="flex items-center gap-3">
                  <MiniVisual kind={cfg.visual} />
                  <span className="h-3 w-px bg-white/10" />
                  <span className="flex items-center gap-1.5 text-[10px] tracking-[0.16em] text-white/35">
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.statusTone}`} />
                    {cfg.status}
                  </span>
                </div>
              )

              return (
                <motion.button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedService(service)}
                  variants={fadeUpV}
                  whileHover={reduceMotion ? {} : { y: -5 }}
                  whileTap={reduceMotion ? {} : { scale: 0.99 }}
                  className={[
                    "group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#080b10]/75 p-6 text-left shadow-2xl shadow-black/10 backdrop-blur-xl transition duration-300 hover:border-cyan-300/25 hover:bg-[#0b1017]/90 hover:shadow-[0_24px_60px_rgba(0,0,0,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/60 sm:p-7",
                    cfg.area,
                    primary ? "min-h-[15.5rem] sm:min-h-[16.5rem]" : "min-h-[12.5rem]",
                    wide ? "min-h-[11rem]" : "",
                  ].join(" ")}
                >
                  <div
                    aria-hidden="true"
                    className={[
                      "pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl transition-opacity duration-300",
                      primary ? "bg-cyan-300/[0.07] opacity-70 group-hover:opacity-100" : "bg-violet-400/[0.06] opacity-60 group-hover:opacity-100",
                    ].join(" ")}
                  />

                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs tracking-widest text-white/25">{service.number}</span>
                        <span className="h-3 w-px bg-white/10" />
                        <span className="font-mono text-[10px] tracking-[0.18em] text-white/30">{cfg.category}</span>
                      </div>
                      <span className="shrink-0 text-xs tracking-wider text-white/25 transition-colors duration-300 group-hover:text-cyan-300">
                        EXPLORE <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                      </span>
                    </div>

                    {wide ? (
                      <div className="mt-6 flex flex-1 flex-col justify-between gap-6 sm:flex-row sm:items-end">
                        <div className="flex items-start gap-4">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200/90 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-cyan-300/30 group-hover:bg-cyan-300/10">
                            <cfg.Icon className="h-[18px] w-[18px]" />
                          </span>
                          {textBlock}
                        </div>
                        {statusBlock}
                      </div>
                    ) : (
                      <>
                        <div className="mt-6 flex-1">
                          <span
                            className={[
                              "mb-5 grid place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200/90 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-cyan-300/30 group-hover:bg-cyan-300/10",
                              primary ? "h-12 w-12" : "h-10 w-10",
                            ].join(" ")}
                          >
                            <cfg.Icon className={primary ? "h-5 w-5" : "h-[18px] w-[18px]"} />
                          </span>
                          {textBlock}
                        </div>
                        <div className="mt-6">{statusBlock}</div>
                      </>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </motion.div>
        </div>
      </section>

      <ServiceDetail service={selectedService} onClose={() => setSelectedService(null)} />
    </>
  )
}
