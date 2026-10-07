"use client";

import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/reveal";

const technologies = [
  { name: "Next.js", description: "Production-ready React framework", category: "Frontend" },
  { name: "React", description: "Composable UI library", category: "Frontend" },
  { name: "TypeScript", description: "Type-safe engineering", category: "Frontend" },
  { name: "Supabase", description: "Database, authentication and secure data", category: "Backend" },
  { name: "n8n", description: "Workflow automation and orchestration", category: "Automation" },
  { name: "OpenAI", description: "AI-powered automation and intelligence", category: "AI" },
  { name: "Vercel", description: "Production hosting and deployment", category: "Infrastructure" },
  { name: "GitHub", description: "Version control and CI workflows", category: "Engineering" },
  { name: "WhatsApp Cloud API", description: "Business messaging and follow-ups", category: "Integrations" },
  { name: "Gmail API", description: "Email communication and automation", category: "Integrations" },
];

export function TechnologyStack() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="tech-stack" aria-label="Technology Stack" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(124,58,237,0.12),transparent_32rem)]" />
        <div className="absolute bottom-[-12rem] left-1/2 -translate-x-1/2 h-[28rem] w-[28rem] rounded-full bg-cyan-400/8 blur-[110px]" />
      </div>
      <div className="container relative">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
<p className="eyebrow mb-4">
              Built on a Modern Automation Stack
            </p>
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
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {technologies.map((tech, index) => (
            <Reveal key={tech.name} delay={index * 0.05}>
              <motion.article
                whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="group relative h-full rounded-2xl border border-white/10 bg-[#0b0f16]/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl hover:border-cyan-300/25 focus-within:border-cyan-300/25 transition-all duration-200"
                aria-label={`${tech.name} - ${tech.description}`}
              >
                <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-cyan-400/5 via-transparent to-violet-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
<div className="mb-4 inline-flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] transition-all duration-300 group-hover:scale-110 group-hover:border-cyan-300/30 group-hover:bg-cyan-300/10">
                    <span className="text-lg font-semibold text-white/80 transition-colors duration-300 group-hover:text-cyan-200">{tech.name.charAt(0)}</span>
                  </div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-white/40">{tech.category}</span>
                </div>
                <h3 className="text-lg font-medium text-white/90">{tech.name}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{tech.description}</p>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

