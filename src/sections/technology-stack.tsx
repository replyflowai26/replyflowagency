"use client";

import type { ReactElement, SVGProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/reveal";

type Technology = {
  name: string;
  description: string;
  category: string;
  layer: string;
  tone: string;
  feature?: boolean;
};

const technologies: Technology[] = [
  { name: "Next.js", description: "Production-ready React framework", category: "Frontend", layer: "Presentation", tone: "bg-sky-300/70" },
  { name: "React", description: "Composable UI library", category: "Frontend", layer: "Interface", tone: "bg-sky-300/70" },
  { name: "TypeScript", description: "Type-safe engineering", category: "Frontend", layer: "Type safety", tone: "bg-sky-300/70" },
  { name: "Supabase", description: "Database, authentication and secure data", category: "Backend", layer: "Data layer", tone: "bg-sky-300/70" },
  { name: "n8n", description: "Workflow automation and orchestration", category: "Automation", layer: "Orchestration", tone: "bg-cyan-300/80", feature: true },
  { name: "OpenAI", description: "AI-powered automation and intelligence", category: "AI", layer: "Intelligence", tone: "bg-violet-300/80", feature: true },
  { name: "Vercel", description: "Production hosting and deployment", category: "Infrastructure", layer: "Delivery", tone: "bg-sky-300/70" },
  { name: "GitHub", description: "Version control and CI workflows", category: "Engineering", layer: "Repository", tone: "bg-sky-300/70" },
  { name: "WhatsApp Cloud API", description: "Business messaging and follow-ups", category: "Integrations", layer: "Messaging channel", tone: "bg-cyan-300/80" },
  { name: "Gmail API", description: "Email communication and automation", category: "Integrations", layer: "Email channel", tone: "bg-cyan-300/80" },
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
    <section id="tech-stack" aria-label="Technology Stack" className="relative overflow-hidden py-20 sm:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(124,58,237,0.12),transparent_32rem)]" />
        <div className="absolute bottom-[-12rem] left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-400/8 blur-[110px]" />
      </div>
      <div className="container relative">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow mb-4">What powers the system</p>
            <h2 className="section-heading text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Reliable tools powering
              <span className="text-gradient"> intelligent automation</span>
            </h2>
            <p className="mt-6 leading-7 text-white/60 sm:text-lg sm:leading-8">
              ReplyFlow connects the tools your business already relies on to automate operations,
              customer communication and growth with reliability, security and scale in mind.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {technologies.map((tech, index) => (
              <Reveal key={tech.name} delay={index * 0.05} className={tech.feature ? "sm:col-span-2" : undefined}>
              <motion.article
                whileHover={reduceMotion ? {} : { y: -3 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={[
                  "group relative flex h-full flex-col rounded-2xl border border-white/10 bg-[#0b0f16]/90 backdrop-blur-xl transition-all duration-200",
                  "shadow-[0_20px_60px_rgba(0,0,0,0.25)] hover:border-cyan-300/30 hover:shadow-[0_28px_70px_rgba(0,0,0,0.4)] focus-within:border-cyan-300/30",
                  tech.feature ? "p-5 sm:p-7" : "p-5 sm:p-6",
                ].join(" ")}
                aria-label={`${tech.name} - ${tech.description}`}
              >
                <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-cyan-400/5 via-transparent to-violet-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="flex items-start justify-between gap-4">
                  <span
                    className={[
                      "grid place-items-center rounded-xl border border-white/10 bg-white/[0.02] font-semibold text-white/80 transition-all duration-300",
                      "group-hover:-translate-y-1 group-hover:border-cyan-300/30 group-hover:bg-cyan-300/10 group-hover:text-cyan-200",
                      tech.feature ? "h-10 w-10 text-lg sm:h-12 sm:w-12 sm:text-xl" : "h-10 w-10 text-lg",
                    ].join(" ")}
                  >
                    {tech.name.charAt(0)}
                  </span>
                  <span className="font-mono text-[0.65rem] tracking-widest text-white/25 transition-colors duration-300 group-hover:text-cyan-300/60">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className={tech.feature ? "mt-4 flex flex-1 flex-col sm:mt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8" : "flex flex-1 flex-col"}>
                  <div className={tech.feature ? "" : "mt-4"}>
                    <h3 className={tech.feature ? "text-lg font-semibold tracking-tight text-white sm:text-xl" : "text-base font-medium text-white/90 sm:text-lg"}>
                      {tech.name}
                    </h3>
                    <p className={tech.feature ? "mt-2 max-w-sm text-sm leading-6 text-white/55" : "mt-2 text-sm leading-6 text-white/55"}>
                      {tech.description}
                    </p>
                  </div>
                  {tech.feature && featureGlyphs[tech.name] && (
                    <span className="mt-4 shrink-0 text-cyan-300/50 transition-all duration-300 group-hover:text-cyan-300/90 sm:mt-0">
                      {featureGlyphs[tech.name]({ className: "h-5 w-11" })}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3.5 sm:mt-5 sm:pt-4">
                  <span className="flex items-center gap-2 rounded-full border border-white/10 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-white/40 transition-colors duration-300 group-hover:border-cyan-300/25 group-hover:text-cyan-200/80">
                    <span className={`h-1.5 w-1.5 rounded-full ${tech.tone} transition-transform duration-300 group-hover:scale-125`} aria-hidden="true" />
                    {tech.category}
                  </span>
                  <span className="min-h-[1.25rem] text-right font-mono text-[0.65rem] uppercase tracking-[0.14em] text-white/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
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
