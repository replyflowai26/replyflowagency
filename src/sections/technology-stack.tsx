"use client";

import type { ReactElement, SVGProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/reveal";

type Accent = "sky" | "cyan" | "violet";

type Technology = {
  name: string;
  description: string;
  category: string;
  layer: string;
  tone: string;
  accent: Accent;
  feature?: boolean;
};

const techAccents: Record<
  Accent,
  { chip: string; card: string; num: string; tile: string; glyph: string; hairline: string }
> = {
  sky: {
    chip: "group-hover:border-sky-600/30 group-hover:text-sky-800",
    card: "hover:border-sky-600/40 focus-within:border-sky-600/40",
    num: "group-hover:text-sky-700",
    tile: "group-hover:border-sky-600/40 group-hover:bg-sky-600/10 group-hover:text-sky-700",
    glyph: "text-sky-700/60 group-hover:text-sky-700",
    hairline: "via-sky-600/40",
  },
  cyan: {
    chip: "group-hover:border-blue-700/30 group-hover:text-blue-800",
    card: "hover:border-blue-700/40 focus-within:border-blue-700/40",
    num: "group-hover:text-blue-700",
    tile: "group-hover:border-blue-700/40 group-hover:bg-blue-700/10 group-hover:text-blue-700",
    glyph: "text-blue-700/60 group-hover:text-blue-700",
    hairline: "via-blue-700/40",
  },
  violet: {
    chip: "group-hover:border-indigo-600/30 group-hover:text-indigo-800",
    card: "hover:border-indigo-600/40 focus-within:border-indigo-600/40",
    num: "group-hover:text-indigo-700",
    tile: "group-hover:border-indigo-600/40 group-hover:bg-indigo-600/10 group-hover:text-indigo-700",
    glyph: "text-indigo-700/60 group-hover:text-indigo-700",
    hairline: "via-indigo-600/40",
  },
};

const technologies: Technology[] = [
  { name: "Next.js", description: "Production-ready React framework", category: "Frontend", layer: "Presentation", tone: "bg-sky-500", accent: "sky" },
  { name: "React", description: "Composable UI library", category: "Frontend", layer: "Interface", tone: "bg-sky-500", accent: "sky" },
  { name: "TypeScript", description: "Type-safe engineering", category: "Frontend", layer: "Type safety", tone: "bg-sky-500", accent: "sky" },
  { name: "Supabase", description: "Database, authentication and secure data", category: "Backend", layer: "Data layer", tone: "bg-sky-500", accent: "sky" },
  { name: "n8n", description: "Workflow automation and orchestration", category: "Automation", layer: "Orchestration", tone: "bg-blue-600", accent: "cyan", feature: true },
  { name: "OpenAI", description: "AI-powered automation and intelligence", category: "AI", layer: "Intelligence", tone: "bg-indigo-500", accent: "violet", feature: true },
  { name: "Vercel", description: "Production hosting and deployment", category: "Infrastructure", layer: "Delivery", tone: "bg-sky-500", accent: "sky" },
  { name: "GitHub", description: "Version control and CI workflows", category: "Engineering", layer: "Repository", tone: "bg-sky-500", accent: "sky" },
  { name: "WhatsApp Cloud API", description: "Business messaging and follow-ups", category: "Integrations", layer: "Messaging channel", tone: "bg-blue-600", accent: "cyan" },
  { name: "Gmail API", description: "Email communication and automation", category: "Integrations", layer: "Email channel", tone: "bg-blue-600", accent: "cyan" },
];

const categoryLegend = [
  { label: "Frontend", tone: "bg-sky-500" },
  { label: "Backend", tone: "bg-sky-500" },
  { label: "Automation", tone: "bg-blue-600" },
  { label: "AI", tone: "bg-indigo-500" },
  { label: "Infrastructure", tone: "bg-sky-500" },
  { label: "Engineering", tone: "bg-sky-500" },
  { label: "Integrations", tone: "bg-blue-600" },
];

function AutomationGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 44 20" fill="none" aria-hidden="true" {...props}>
      <rect x="1.5" y="6" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="18" y="6" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="34.5" y="6" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 10h7M27 10h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IntelligenceGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 44 20" fill="none" aria-hidden="true" {...props}>
      <path d="M6 14a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="22" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="34" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9.5v2M22 7v5M34 9.5v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const featureGlyphs: Record<string, (props: SVGProps<SVGSVGElement>) => ReactElement> = {
  n8n: AutomationGlyph,
  OpenAI: IntelligenceGlyph,
};

export function TechnologyStack() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="tech-stack" aria-label="Technology Stack" className="chapter-ink relative overflow-hidden py-16 sm:py-24">
      <div className="container relative">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow-light mb-4">What powers the system</p>
            <h2 className="font-display text-4xl font-semibold leading-[1.02] text-white sm:text-5xl lg:text-6xl">
              Reliable tools powering
              <span className="text-gradient"> intelligent automation</span>
            </h2>
            <p className="mt-6 leading-7 text-white/70 sm:text-lg sm:leading-8">
              ReplyFlow connects the tools your business already relies on to automate operations,
              customer communication and growth with reliability, security and scale in mind.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="Technology categories">
            {categoryLegend.map((cat) => (
              <span key={cat.label} className="flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white/50">
                <span className={`h-1.5 w-1.5 rounded-full ${cat.tone}`} aria-hidden="true" />
                {cat.label}
              </span>
            ))}
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {technologies.map((tech, index) => (
              <Reveal key={tech.name} delay={index * 0.05} className={tech.feature ? "sm:col-span-2" : undefined}>
              <motion.article
                whileHover={reduceMotion ? {} : { y: -3 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={[
                  "plate-tile group relative flex h-full flex-col rounded-2xl transition-[border-color,box-shadow] duration-200",
                  "hover:shadow-[0_20px_48px_rgba(4,8,18,0.12)]",
                  techAccents[tech.accent].card,
                  tech.feature ? "p-5 sm:p-7" : "p-5 sm:p-6",
                ].join(" ")}
                aria-label={`${tech.name} - ${tech.description}`}
              >
                {tech.feature && (
                  <div aria-hidden="true" className={`absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent to-transparent sm:inset-x-7 ${techAccents[tech.accent].hairline}`} />
                )}

                <div className="flex items-start justify-between gap-4">
                  <span
                    className={[
                      "grid place-items-center rounded-xl border border-line-ink bg-paper font-semibold text-ink transition-all duration-300",
                      "group-hover:-translate-y-1",
                      techAccents[tech.accent].tile,
                      tech.feature ? "h-10 w-10 text-lg sm:h-12 sm:w-12 sm:text-xl" : "h-10 w-10 text-lg",
                    ].join(" ")}
                  >
                    {tech.name.charAt(0)}
                  </span>
                  <span className={["font-mono text-[0.65rem] tracking-widest text-ink-soft transition-colors duration-300", techAccents[tech.accent].num].join(" ")}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className={tech.feature ? "mt-4 flex flex-1 flex-col sm:mt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8" : "flex flex-1 flex-col"}>
                  <div className={tech.feature ? "" : "mt-4"}>
                    <h3 className={tech.feature ? "font-display text-lg font-semibold tracking-tight text-ink sm:text-xl" : "text-base font-medium text-ink/90 sm:text-lg"}>
                      {tech.name}
                    </h3>
                    <p className={tech.feature ? "mt-2 max-w-sm text-sm leading-6 text-ink-muted" : "mt-2 text-sm leading-6 text-ink-muted"}>
                      {tech.description}
                    </p>
                  </div>
                  {tech.feature && featureGlyphs[tech.name] && (
                    <span className={["mt-4 shrink-0 transition-all duration-300 sm:mt-0", techAccents[tech.accent].glyph].join(" ")}>
                      {featureGlyphs[tech.name]({ className: "h-5 w-11" })}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-ink pt-3.5 sm:mt-5 sm:pt-4">
                  <span className={["flex items-center gap-2 rounded-full border border-line-ink bg-paper px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-ink-muted transition-colors duration-300", techAccents[tech.accent].chip].join(" ")}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tech.tone} ${tech.feature ? "pulse-dot" : ""} transition-transform duration-300 group-hover:scale-125`} aria-hidden="true" />
                    {tech.category}
                  </span>
                  <span className="min-h-[1.25rem] text-right font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-soft transition-colors duration-300 group-hover:text-ink-muted">
                    {tech.layer}
                  </span>
                </div>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}