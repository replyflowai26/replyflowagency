"use client"

import { motion, useInView, useReducedMotion, useScroll } from "motion/react"
import { useRef, type ReactElement, type SVGProps } from "react"
import { fadeUp, fadeUpInstant, cardViewport } from "@/lib/motion"

function AuditIcon(props: SVGProps<SVGSVGElement>): ReactElement {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M3.5 4.5h13l-4.8 5.8v4.9L8.3 16.5v-6.2L3.5 4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
}

function DesignIcon(props: SVGProps<SVGSVGElement>): ReactElement {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><circle cx="5" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.5" /><circle cx="15" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="15" r="2.2" stroke="currentColor" strokeWidth="1.5" /><path d="M7.2 5.5h5.6M6 7.5l3 5.6M14 7.5l-3 5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
}

function BuildIcon(props: SVGProps<SVGSVGElement>): ReactElement {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><circle cx="4.5" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" /><circle cx="15.5" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" /><path d="M7 10h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M10 7.8 12.4 10 10 12.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function OptimizeIcon(props: SVGProps<SVGSVGElement>): ReactElement {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M3.5 13.5a6.5 6.5 0 1 1 13 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M10 13.5 13.2 8.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="10" cy="13.5" r="1.3" fill="currentColor" /></svg>
}

type Accent = "sky" | "cyan" | "violet" | "emerald"

type StepAccent = {
  node: string
  nodeOnColor: string
  nodeOnGlow: string
  card: string
  cardHover: string
  num: string
  meta: string
  icon: string
  iconHover: string
}

const accents: Record<Accent, StepAccent> = {
  sky: {
    node: "border-sky-600/45",
    nodeOnColor: "rgb(2, 132, 199)",
    nodeOnGlow: "0 0 20px rgba(2, 132, 199, 0.35)",
    card: "border-sky-600/25 bg-paper-lift",
    cardHover: "border-line-ink bg-paper-lift hover:border-sky-600/35 hover:shadow-[0_14px_40px_rgba(9,14,26,0.10)]",
    num: "text-sky-700",
    meta: "text-sky-700/75",
    icon: "border-sky-600/30 bg-sky-600/10 text-sky-700",
    iconHover: "border-line-ink bg-paper text-ink-soft group-hover:border-sky-600/30 group-hover:bg-sky-600/10 group-hover:text-sky-700",
  },
  cyan: {
    node: "border-blue-600/45",
    nodeOnColor: "rgb(37, 99, 235)",
    nodeOnGlow: "0 0 20px rgba(37, 99, 235, 0.35)",
    card: "border-blue-600/25 bg-paper-lift",
    cardHover: "border-line-ink bg-paper-lift hover:border-blue-600/35 hover:shadow-[0_14px_40px_rgba(9,14,26,0.10)]",
    num: "text-blue-700",
    meta: "text-blue-700/75",
    icon: "border-blue-600/30 bg-blue-600/10 text-blue-700",
    iconHover: "border-line-ink bg-paper text-ink-soft group-hover:border-blue-600/30 group-hover:bg-blue-600/10 group-hover:text-blue-700",
  },
  violet: {
    node: "border-indigo-600/45",
    nodeOnColor: "rgb(79, 70, 229)",
    nodeOnGlow: "0 0 20px rgba(79, 70, 229, 0.35)",
    card: "border-indigo-600/25 bg-paper-lift",
    cardHover: "border-line-ink bg-paper-lift hover:border-indigo-600/35 hover:shadow-[0_14px_40px_rgba(9,14,26,0.10)]",
    num: "text-indigo-700",
    meta: "text-indigo-700/75",
    icon: "border-indigo-600/30 bg-indigo-600/10 text-indigo-700",
    iconHover: "border-line-ink bg-paper text-ink-soft group-hover:border-indigo-600/30 group-hover:bg-indigo-600/10 group-hover:text-indigo-700",
  },
  emerald: {
    node: "border-emerald-600/45",
    nodeOnColor: "rgb(5, 150, 105)",
    nodeOnGlow: "0 0 20px rgba(5, 150, 105, 0.35)",
    card: "border-emerald-600/25 bg-paper-lift",
    cardHover: "border-line-ink bg-paper-lift hover:border-emerald-600/35 hover:shadow-[0_14px_40px_rgba(9,14,26,0.10)]",
    num: "text-emerald-700",
    meta: "text-emerald-700/75",
    icon: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
    iconHover: "border-line-ink bg-paper text-ink-soft group-hover:border-emerald-600/30 group-hover:bg-emerald-600/10 group-hover:text-emerald-700",
  },
}

const steps = [
  { number: "01", title: "Audit", description: "Map the manual work and bottlenecks.", meta: "DISCOVERY", Icon: AuditIcon, accent: "sky" as Accent },
  { number: "02", title: "Design", description: "Design the automation architecture.", meta: "ARCHITECTURE", Icon: DesignIcon, accent: "cyan" as Accent },
  { number: "03", title: "Build", description: "Connect AI, data and business tools.", meta: "INTEGRATION", Icon: BuildIcon, accent: "violet" as Accent },
  { number: "04", title: "Optimize", description: "Measure, improve and scale the system.", meta: "IMPROVEMENT", Icon: OptimizeIcon, accent: "emerald" as Accent },
]

function ProcessStep({
  number,
  title,
  description,
  meta,
  Icon,
  accent,
}: {
  number: string
  title: string
  description: string
  meta: string
  Icon: (props: SVGProps<SVGSVGElement>) => ReactElement
  accent: Accent
}) {
  const a = accents[accent]
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLElement | null>(null)
  const inView = useInView(ref, { amount: 0.6 })

  return (
    <motion.article
      ref={ref}
      variants={reduceMotion ? fadeUpInstant : fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={cardViewport}
      className={[
        "group relative ml-10 rounded-3xl border p-6 shadow-[0_1px_0_rgba(11,14,21,0.04),0_18px_44px_rgba(4,8,18,0.14)] transition-colors duration-300 sm:p-7",
        inView ? a.card : a.cardHover,
      ].join(" ")}
    >
      <motion.div
        aria-hidden="true"
        className={`absolute -left-[30px] top-8 block h-3 w-3 rounded-full border-2 bg-paper ${a.node}`}
        animate={reduceMotion ? undefined : { scale: inView ? 1.35 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        style={inView ? { boxShadow: a.nodeOnGlow, borderColor: a.nodeOnColor } : undefined}
      />
      <div className="flex items-start gap-4 sm:gap-5">
        <span
          className={[
            "pt-1 font-mono text-xs tracking-widest transition-colors duration-300",
            inView ? a.num : "text-ink-soft",
          ].join(" ")}
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <p className={["font-mono text-[10px] tracking-[0.18em] transition-colors duration-300", inView ? a.meta : "text-ink-soft"].join(" ")}>{meta}</p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted sm:text-base sm:leading-7">{description}</p>
        </div>
        <span
          className={[
            "mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors duration-300",
            inView ? a.icon : a.iconHover,
          ].join(" ")}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </motion.article>
  )
}

export function Process() {
  const reduceMotion = useReducedMotion()
  const stepsRef = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({ target: stepsRef, offset: ["start 0.8", "end 0.45"] })

  return (
    <section id="process" className="relative overflow-hidden bg-paper py-16 sm:py-24">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:items-start">
          <motion.div
            variants={reduceMotion ? fadeUpInstant : fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={cardViewport}
          >
            <p className="eyebrow text-blue-ink">How we build it</p>
            <h2 className="mt-4 max-w-md font-display text-4xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-5xl">
              Built like a system, not a collection of hacks.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-ink-muted">
              Every automation starts with the business outcome, then gets designed, connected and measured.
            </p>
            <p className="mt-8 font-mono text-[11px] uppercase leading-5 tracking-[0.18em] text-ink-soft">
              Discover <span className="text-ink-soft">→</span> Architect <span className="text-ink-soft">→</span> Integrate <span className="text-ink-soft">→</span> Optimize
            </p>
          </motion.div>

          <div ref={stepsRef} className="relative">
            <div aria-hidden="true" className="absolute bottom-8 left-[16px] top-8 w-px bg-gradient-to-b from-line-ink via-line-ink to-transparent" />
            <motion.div
              aria-hidden="true"
              className="absolute bottom-8 left-[16px] top-8 w-px origin-top bg-gradient-to-b from-blue-ink via-ultra-ink to-emerald-600"
              style={{ scaleY: reduceMotion ? 0 : scrollYProgress }}
            />
            <div className="space-y-4">
              {steps.map((step) => (
                <ProcessStep key={step.number} {...step} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}