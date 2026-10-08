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
    node: "border-sky-300/40",
    nodeOnColor: "rgba(125, 211, 252, 0.85)",
    nodeOnGlow: "0 0 22px rgba(125, 211, 252, 0.5)",
    card: "border-sky-300/30 bg-white/[0.05]",
    cardHover: "border-white/8 bg-white/[0.025] hover:border-sky-300/25 hover:bg-white/[0.04]",
    num: "text-sky-300",
    meta: "text-sky-200/70",
    icon: "border-sky-300/40 bg-sky-300/10 text-sky-200",
    iconHover: "border-white/10 bg-white/[0.04] text-white/45 group-hover:border-sky-300/30 group-hover:text-sky-200/70",
  },
  cyan: {
    node: "border-cyan-300/40",
    nodeOnColor: "rgba(103, 232, 249, 0.85)",
    nodeOnGlow: "0 0 22px rgba(103, 232, 249, 0.55)",
    card: "border-cyan-300/30 bg-white/[0.05]",
    cardHover: "border-white/8 bg-white/[0.025] hover:border-cyan-300/25 hover:bg-white/[0.04]",
    num: "text-cyan-300",
    meta: "text-cyan-200/70",
    icon: "border-cyan-300/40 bg-cyan-300/10 text-cyan-200",
    iconHover: "border-white/10 bg-white/[0.04] text-white/45 group-hover:border-cyan-300/30 group-hover:text-cyan-200/70",
  },
  violet: {
    node: "border-violet-300/40",
    nodeOnColor: "rgba(196, 181, 253, 0.85)",
    nodeOnGlow: "0 0 22px rgba(196, 181, 253, 0.5)",
    card: "border-violet-300/30 bg-white/[0.05]",
    cardHover: "border-white/8 bg-white/[0.025] hover:border-violet-300/25 hover:bg-white/[0.04]",
    num: "text-violet-300",
    meta: "text-violet-200/70",
    icon: "border-violet-300/40 bg-violet-300/10 text-violet-200",
    iconHover: "border-white/10 bg-white/[0.04] text-white/45 group-hover:border-violet-300/30 group-hover:text-violet-200/70",
  },
  emerald: {
    node: "border-emerald-300/40",
    nodeOnColor: "rgba(110, 231, 183, 0.85)",
    nodeOnGlow: "0 0 22px rgba(110, 231, 183, 0.5)",
    card: "border-emerald-300/30 bg-white/[0.05]",
    cardHover: "border-white/8 bg-white/[0.025] hover:border-emerald-300/25 hover:bg-white/[0.04]",
    num: "text-emerald-300",
    meta: "text-emerald-200/70",
    icon: "border-emerald-300/40 bg-emerald-300/10 text-emerald-200",
    iconHover: "border-white/10 bg-white/[0.04] text-white/45 group-hover:border-emerald-300/30 group-hover:text-emerald-200/70",
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
        "group relative ml-10 rounded-3xl border p-6 transition-colors duration-300 sm:p-7",
        inView ? a.card : a.cardHover,
      ].join(" ")}
    >
      <motion.div
        aria-hidden="true"
        className={`absolute -left-[30px] top-8 block h-3 w-3 rounded-full border bg-[#05070b] ${a.node}`}
        animate={reduceMotion ? undefined : { scale: inView ? 1.35 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        style={inView ? { boxShadow: a.nodeOnGlow, borderColor: a.nodeOnColor } : undefined}
      />
      <div className="flex items-start gap-4 sm:gap-5">
        <span
          className={[
            "pt-1 font-mono text-xs tracking-widest transition-colors duration-300",
            inView ? a.num : "text-white/25",
          ].join(" ")}
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <p className={["font-mono text-[10px] tracking-[0.18em] transition-colors duration-300", inView ? a.meta : "text-white/30"].join(" ")}>{meta}</p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/45 sm:text-base sm:leading-7">{description}</p>
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
    <section id="process" className="relative overflow-hidden border-y border-white/10 bg-white/[0.012] py-28 sm:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-8 h-80 w-80 rounded-full bg-violet-500/[0.06] blur-[110px]" />
        <div className="absolute -right-32 top-1/2 h-96 w-96 rounded-full bg-cyan-400/[0.05] blur-[120px]" />
      </div>
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <motion.div
            variants={reduceMotion ? fadeUpInstant : fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={cardViewport}
          >
            <p className="text-sm font-medium tracking-[0.2em] text-violet-300">HOW WE BUILD IT</p>
            <h2 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
              Built like a system, not a collection of hacks.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-white/45">
              Every automation starts with the business outcome, then gets designed, connected and measured.
            </p>
            <p className="mt-8 font-mono text-[11px] uppercase leading-5 tracking-[0.18em] text-white/25">
              Discover <span className="text-white/20">→</span> Architect <span className="text-white/20">→</span> Integrate <span className="text-white/20">→</span> Optimize
            </p>
          </motion.div>

          <div ref={stepsRef} className="relative">
            <div aria-hidden="true" className="absolute bottom-8 left-[16px] top-8 w-px bg-gradient-to-b from-white/12 via-white/8 to-transparent" />
            <motion.div
              aria-hidden="true"
              className="absolute bottom-8 left-[16px] top-8 w-px origin-top bg-gradient-to-b from-sky-300/70 via-violet-300/45 to-emerald-300/30"
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