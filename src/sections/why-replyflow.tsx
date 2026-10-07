"use client";

import type { ReactElement, SVGProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import { staggerContainer, staggerContainerInstant, fadeUp, fadeUpInstant, cardViewport } from "@/lib/motion";

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

type Outcome = { title: string; description: string; Icon: IconComponent };

function LayersIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M10 3 17.5 7 10 11 2.5 7 10 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="m2.5 11 7.5 4 7.5-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function BoltIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M11.2 2 5 10.6h4.2L8.8 18l6.2-8.6h-4.2L11.2 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function NetworkIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><circle cx="5" cy="14" r="2.3" stroke="currentColor" strokeWidth="1.6" /><circle cx="15" cy="14" r="2.3" stroke="currentColor" strokeWidth="1.6" /><circle cx="10" cy="5" r="2.3" stroke="currentColor" strokeWidth="1.6" /><path d="M7.2 12.4 8.8 7.2M12.8 12.4 11.2 7.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function GaugeIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M4 15.5v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M8.5 15.5v-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M13 15.5v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M3 15.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

const outcomes: Outcome[] = [
  { title: "Less manual work", description: "Repetitive operational tasks handled by connected workflows instead of your team.", Icon: LayersIcon },
  { title: "Faster customer response", description: "Communication and follow-up workflows that keep every inquiry moving.", Icon: BoltIcon },
  { title: "Connected business systems", description: "CRM, communication, AI and business tools sharing context automatically.", Icon: NetworkIcon },
  { title: "Measurable operations", description: "Workflow activity surfaced as operational visibility you can act on.", Icon: GaugeIcon },
];

export function WhyReplyFlow() {
  const reduceMotion = useReducedMotion();
  const stagger = reduceMotion ? staggerContainerInstant : staggerContainer;
  const fadeUpV = reduceMotion ? fadeUpInstant : fadeUp;

  return (
    <section id="why-replyflow" aria-labelledby="why-replyflow-heading" className="relative overflow-hidden py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.07),transparent_30rem)]" />
      <div className="container relative">
        <motion.div
          variants={fadeUpV}
          initial="hidden"
          whileInView="visible"
          viewport={cardViewport}
          className="max-w-2xl"
        >
          <p className="eyebrow">Why ReplyFlow</p>
          <h2 id="why-replyflow-heading" className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            A system designed around the outcomes you need.
          </h2>
          <p className="mt-6 leading-7 text-white/45 sm:text-lg">
            Practical capability statements — the patterns every ReplyFlow build is designed around.
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={cardViewport}
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {outcomes.map((outcome) => (
            <motion.article
              key={outcome.title}
              variants={fadeUpV}
              whileHover={reduceMotion ? {} : { y: -4 }}
              className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition-colors duration-300 hover:border-cyan-300/25 hover:bg-white/[0.05]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200/90 transition-colors duration-300 group-hover:border-cyan-300/30 group-hover:bg-cyan-300/10">
                <outcome.Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-base font-semibold tracking-tight text-white">{outcome.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/45">{outcome.description}</p>
            </motion.article>
          ))}
        </motion.div>

        <motion.div
          variants={fadeUpV}
          initial="hidden"
          whileInView="visible"
          viewport={cardViewport}
          className="mt-12 flex justify-center"
        >
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/85 transition-colors duration-300 hover:border-cyan-300/30 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/60"
          >
            Tell us what you want to automate <span aria-hidden="true">→</span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}