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
type Hue = "cyan" | "sky" | "violet" | "emerald"

type CardConfig = {
  area: string
  tier: Tier
  category: string
  status: string
  statusTone: string
  visual: CardVisual
  hue: Hue
  tileTone: string
  tileHover: string
  Icon: (props: SVGProps<SVGSVGElement>) => ReactElement
}

const cardConfig: Record<string, CardConfig> = {
  "lead-generation": {
    area: "sm:col-span-2 lg:col-span-4",
    tier: "primary",
    category: "ACQUISITION",
    status: "LIVE",
    statusTone: "bg-emerald-500",
    visual: "route",
    hue: "cyan",
    tileTone: "text-blue-700",
    tileHover: "group-hover:border-blue-700/30 group-hover:bg-blue-700/10",
    Icon: LeadIcon,
  },
  "sales-automation": {
    area: "lg:col-span-2",
    tier: "primary",
    category: "REVENUE",
    status: "ACTIVE",
    statusTone: "bg-blue-600",
    visual: "pipeline",
    hue: "sky",
    tileTone: "text-sky-700",
    tileHover: "group-hover:border-sky-700/30 group-hover:bg-sky-700/10",
    Icon: SalesIcon,
  },
  "customer-support": {
    area: "lg:col-span-2",
    tier: "secondary",
    category: "SUCCESS",
    status: "AI-ASSISTED",
    statusTone: "bg-indigo-500",
    visual: "reply",
    hue: "cyan",
    tileTone: "text-blue-700",
    tileHover: "group-hover:border-blue-700/30 group-hover:bg-blue-700/10",
    Icon: SupportIcon,
  },
  "operations": {
    area: "lg:col-span-2",
    tier: "secondary",
    category: "BACK OFFICE",
    status: "AUTOMATED",
    statusTone: "bg-blue-600",
    visual: "mesh",
    hue: "sky",
    tileTone: "text-sky-700",
    tileHover: "group-hover:border-sky-700/30 group-hover:bg-sky-700/10",
    Icon: OpsIcon,
  },
  "reporting": {
    area: "lg:col-span-2",
    tier: "secondary",
    category: "SIGNALS",
    status: "SYNCED",
    statusTone: "bg-emerald-500",
    visual: "chart",
    hue: "emerald",
    tileTone: "text-emerald-700",
    tileHover: "group-hover:border-emerald-700/30 group-hover:bg-emerald-700/10",
    Icon: ReportIcon,
  },
  "custom-ai-systems": {
    area: "sm:col-span-2 lg:col-span-6",
    tier: "secondary",
    category: "PLATFORM",
    status: "CONFIGURABLE",
    statusTone: "bg-indigo-500",
    visual: "slots",
    hue: "violet",
    tileTone: "text-indigo-700",
    tileHover: "group-hover:border-indigo-700/30 group-hover:bg-indigo-700/10",
    Icon: CustomIcon,
  },
}

const visualTones: Record<Hue, { node: string; bar: string; barHi: string; line: string; edge: string; edge2: string; slot: string; slotFill: string }> = {
  cyan: {
    node: "group-hover:border-blue-600/70 group-hover:bg-blue-600/20",
    bar: "group-hover:bg-blue-600/50",
    barHi: "group-hover:bg-blue-600/80",
    line: "group-hover:text-blue-600/80",
    edge: "group-hover:border-blue-600/50",
    edge2: "group-hover:border-blue-600/60",
    slot: "group-hover:border-blue-600/40",
    slotFill: "group-hover:bg-blue-600/25",
  },
  sky: {
    node: "group-hover:border-sky-600/70 group-hover:bg-sky-600/20",
    bar: "group-hover:bg-sky-600/50",
    barHi: "group-hover:bg-sky-600/80",
    line: "group-hover:text-sky-600/80",
    edge: "group-hover:border-sky-600/50",
    edge2: "group-hover:border-sky-600/60",
    slot: "group-hover:border-sky-600/40",
    slotFill: "group-hover:bg-sky-600/25",
  },
  violet: {
    node: "group-hover:border-indigo-600/70 group-hover:bg-indigo-600/20",
    bar: "group-hover:bg-indigo-600/50",
    barHi: "group-hover:bg-indigo-600/80",
    line: "group-hover:text-indigo-600/80",
    edge: "group-hover:border-indigo-600/50",
    edge2: "group-hover:border-indigo-600/60",
    slot: "group-hover:border-indigo-600/45",
    slotFill: "group-hover:bg-indigo-600/30",
  },
  emerald: {
    node: "group-hover:border-emerald-600/70 group-hover:bg-emerald-600/20",
    bar: "group-hover:bg-emerald-600/50",
    barHi: "group-hover:bg-emerald-600/80",
    line: "group-hover:text-emerald-600/80",
    edge: "group-hover:border-emerald-600/50",
    edge2: "group-hover:border-emerald-600/60",
    slot: "group-hover:border-emerald-600/40",
    slotFill: "group-hover:bg-emerald-600/25",
  },
}

function MiniVisual({ kind, hue }: { kind: CardVisual; hue: Hue }) {
  const t = visualTones[hue]
  if (kind === "route") {
    return (
      <span className="flex w-24 items-center gap-1.5" aria-hidden="true">
        <span className={`h-2.5 w-2.5 rounded-[3px] border border-ink/20 bg-paper transition-colors duration-300 ${t.node}`} />
        <span className={`h-px flex-1 bg-ink/15 transition-colors duration-300 ${t.bar}`} />
        <span className={`h-2.5 w-2.5 rounded-[3px] border border-ink/20 bg-paper transition-colors duration-300 delay-100 ${t.node}`} />
        <span className={`h-px flex-1 bg-ink/15 transition-colors duration-300 delay-100 ${t.bar}`} />
        <span className={`h-2.5 w-2.5 rounded-[3px] border border-ink/20 bg-paper transition-colors duration-300 delay-200 ${t.node}`} />
      </span>
    )
  }
  if (kind === "pipeline") {
    return (
      <span className="flex h-5 items-end gap-1.5" aria-hidden="true">
        <span className={`h-2 w-1.5 rounded-sm bg-ink/15 transition-colors duration-300 ${t.bar}`} />
        <span className={`h-3 w-1.5 rounded-sm bg-ink/15 transition-colors duration-300 delay-75 ${t.bar}`} />
        <span className={`h-4 w-1.5 rounded-sm bg-ink/15 transition-colors duration-300 delay-100 ${t.bar}`} />
        <span className={`h-5 w-1.5 rounded-sm bg-blue-ink/40 transition-colors duration-300 delay-150 ${t.barHi}`} />
        <span className={`h-5 w-1.5 rounded-sm bg-ink/20 transition-colors duration-300 delay-200 ${t.barHi}`} />
      </span>
    )
  }
  if (kind === "reply") {
    return (
      <span className="flex h-5 items-end gap-1.5" aria-hidden="true">
        <span className={`h-4 w-6 rounded-md rounded-br-sm border border-ink/25 bg-paper transition-colors duration-300 ${t.edge}`} />
        <span className="h-3.5 w-5 rounded-md rounded-tl-sm border border-indigo-600/40 bg-paper transition-colors duration-300 delay-100 group-hover:border-indigo-600/70 group-hover:bg-indigo-600/10" />
      </span>
    )
  }
  if (kind === "mesh") {
    return (
      <svg viewBox="0 0 64 20" fill="none" className={`h-5 w-24 text-ink-soft transition-colors duration-300 ${t.line}`} aria-hidden="true">
        <path d="M10 10h20M34 10h20M32 7.5 10.5 9M32 12.5 53.5 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="32" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="57" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    )
  }
  if (kind === "chart") {
    return (
      <svg viewBox="0 0 64 20" fill="none" className={`h-5 w-24 text-ink-soft transition-colors duration-300 ${t.line}`} aria-hidden="true">
        <path d="M3 16l12-5 10 2 14-7 10 3 12-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="61" cy="2" r="2" fill="currentColor" />
      </svg>
    )
  }
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      <span className={`h-3.5 w-3.5 rounded-[4px] border border-ink/20 bg-paper transition-colors duration-300 ${t.slot}`} />
      <span className="h-3.5 w-3.5 rounded-[4px] border border-indigo-600/50 bg-indigo-600/15 transition-colors duration-300 group-hover:bg-indigo-600/30" />
      <span className={`h-3.5 w-3.5 rounded-[4px] border border-ink/20 bg-paper transition-colors duration-300 delay-100 ${t.slot}`} />
      <span className={`h-3.5 w-3.5 rounded-[4px] border border-ink/20 bg-paper transition-colors duration-300 delay-200 ${t.slot}`} />
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
      <section id="services" className="relative overflow-hidden bg-paper py-16 sm:py-24">
        <div className="container">
          <motion.div
            variants={fadeUpV}
            initial="hidden"
            whileInView="visible"
            viewport={cardViewport}
            className="max-w-3xl"
          >
            <p className="eyebrow text-blue-ink">What we build</p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-5xl lg:text-6xl">
              One automation layer for the work that slows you down.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">
              Modular automation systems we design, build and maintain — connecting your people, data and tools into one reliable operating flow.
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
                      "font-display font-semibold tracking-tight text-ink",
                      primary ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
                    ].join(" ")}
                  >
                    {service.title}
                  </h3>
                  <p
                    className={[
                      "mt-3 text-base leading-7 text-ink-muted",
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
                  <MiniVisual kind={cfg.visual} hue={cfg.hue} />
                  <span className="h-3 w-px bg-line-ink" />
                  <span className="flex items-center gap-1.5 text-[10px] tracking-[0.16em] text-ink-soft">
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
                    "plate-tile group relative overflow-hidden rounded-[1.75rem] p-6 text-left transition-[border-color,box-shadow] duration-300 hover:border-blue-ink/40 hover:shadow-[0_22px_55px_rgba(4,8,18,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-ink sm:p-7",
                    cfg.area,
                    primary ? "min-h-[15.5rem] sm:min-h-[16.5rem]" : "min-h-[12.5rem]",
                    wide ? "min-h-[11rem]" : "",
                  ].join(" ")}
                >
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs tracking-widest text-ink-soft">{service.number}</span>
                        <span className="h-3 w-px bg-line-ink" />
                        <span className="font-mono text-[10px] tracking-[0.18em] text-ink-muted">{cfg.category}</span>
                      </div>
                      <span className="shrink-0 text-xs tracking-wider text-ink-soft transition-colors duration-300 group-hover:text-blue-ink">
                        EXPLORE <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                      </span>
                    </div>

                    {wide ? (
                      <div className="mt-6 flex flex-1 flex-col justify-between gap-6 sm:flex-row sm:items-end">
                        <div className="flex items-start gap-4">
                          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-ink bg-paper transition-all duration-300 group-hover:-translate-y-1 ${cfg.tileTone} ${cfg.tileHover}`}>
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
                              "mb-5 grid place-items-center rounded-xl border border-line-ink bg-paper transition-all duration-300 group-hover:-translate-y-1",
                              cfg.tileTone,
                              cfg.tileHover,
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