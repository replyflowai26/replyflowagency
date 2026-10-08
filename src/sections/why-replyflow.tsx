"use client";

import type { ReactElement, SVGProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import { staggerContainer, staggerContainerInstant, fadeUp, fadeUpInstant, cardViewport } from "@/lib/motion";

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

function BoltIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M11.2 2 5 10.6h4.2L8.8 18l6.2-8.6h-4.2L11.2 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" /><path d="M10 6.6V10l2.5 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function NetworkIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><circle cx="5" cy="14" r="2.3" stroke="currentColor" strokeWidth="1.6" /><circle cx="15" cy="14" r="2.3" stroke="currentColor" strokeWidth="1.6" /><circle cx="10" cy="5" r="2.3" stroke="currentColor" strokeWidth="1.6" /><path d="M7.2 12.4 8.8 7.2M12.8 12.4 11.2 7.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function GaugeIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M4 15.5v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M8.5 15.5v-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M13 15.5v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M3 15.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function StackIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M10 3 17.5 7 10 11 2.5 7 10 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="m2.5 11 7.5 4 7.5-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="m2.5 14.5 7.5 4 7.5-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

type SupportingOutcome = {
  title: string;
  description: string;
  Icon: IconComponent;
};

const supportingOutcomes: SupportingOutcome[] = [
  {
    title: "Faster lead response",
    description: "New inquiries get a fast, consistent first response instead of waiting in an inbox.",
    Icon: BoltIcon,
  },
  {
    title: "Consistent follow-up",
    description: "Sequenced follow-ups go out on time without someone remembering to send them.",
    Icon: ClockIcon,
  },
  {
    title: "Connected operations",
    description: "CRM, messaging and business tools share context so work moves between them automatically.",
    Icon: NetworkIcon,
  },
  {
    title: "Better visibility",
    description: "Activity across the workflow surfaces as clear signals you can make decisions with.",
    Icon: GaugeIcon,
  },
  {
    title: "Scalable systems",
    description: "The same system handles more volume without adding more manual work to your team.",
    Icon: StackIcon,
  },
];

const primaryFlow = [
  { label: "Repetitive work", detail: "The manual routine slowing the team down" },
  { label: "Automation system", detail: "AI, CRM and messaging connected into one flow" },
  { label: "Business outcome", detail: "Work runs on its own, consistently" },
];

function SignalStrip() {
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={[
            "h-1.5 w-1.5 rounded-[3px] border border-white/20 bg-white/5 transition-colors duration-300",
            `delay-${i * 75}`,
            "group-hover:border-cyan-300/60 group-hover:bg-cyan-300/25",
          ].join(" ")}
        />
      ))}
    </span>
  );
}

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
          <p className="eyebrow">What result ReplyFlow creates</p>
          <h2 id="why-replyflow-heading" className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            A system designed around the outcomes you need.
          </h2>
          <p className="mt-6 leading-7 text-white/45 sm:text-lg">
            Less repetitive work, faster response and operations that scale — the reasons to automate
            in the first place.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          <motion.article
            variants={fadeUpV}
            initial="hidden"
            whileInView="visible"
            viewport={cardViewport}
            whileHover={reduceMotion ? {} : { y: -4 }}
            className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#080b10]/75 p-7 shadow-2xl shadow-black/10 backdrop-blur-xl transition-colors duration-300 hover:border-cyan-300/25 sm:p-9"
          >
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-300/[0.06] blur-3xl transition-opacity duration-300 opacity-70 group-hover:opacity-100" />

            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs tracking-widest text-white/25">PRIMARY OUTCOME</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <h3 className="mt-6 max-w-md text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-4xl">
                Turn repetitive business work into systems that run.
              </h3>
              <p className="mt-5 max-w-md text-base leading-7 text-white/45">
                Your team stops repeating the same tasks and starts operating a system — response,
                follow-up and reporting handled by connected automation instead of people.
              </p>

              <ol className="mt-8 space-y-0" aria-label="From repetitive work to business outcome">
                {primaryFlow.map((stage, index) => (
                  <li key={stage.label} className="relative flex gap-3.5">
                    <div className="flex flex-col items-center" aria-hidden="true">
                      <span className="mt-1.5 h-2 w-2 rounded-full border border-cyan-300/50 bg-cyan-300/20" />
                      {index < primaryFlow.length - 1 && (
                        <span className="relative my-1.5 min-h-[30px] w-px flex-1 bg-white/12">
                          <span className="workflow-pulse workflow-pulse-v" style={{ animationDelay: `${index * 0.5}s` }} />
                        </span>
                      )}
                    </div>
                    <div className={index < primaryFlow.length - 1 ? "pb-5" : ""}>
                      <p className="text-sm font-medium text-white/85">
                        <span className="mr-2 font-mono text-[10px] tracking-widest text-cyan-300/50">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {stage.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/40">{stage.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </motion.article>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={cardViewport}
            className="grid gap-4 sm:grid-cols-2"
          >
            {supportingOutcomes.map((outcome, index) => (
              <motion.article
                key={outcome.title}
                variants={fadeUpV}
                whileHover={reduceMotion ? {} : { y: -4 }}
                className={[
                  "group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition-colors duration-300 hover:border-cyan-300/25 hover:bg-white/[0.05]",
                  index === supportingOutcomes.length - 1 ? "sm:col-span-2" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200/90 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-cyan-300/30 group-hover:bg-cyan-300/10">
                    <outcome.Icon className="h-5 w-5" />
                  </span>
                  <span className="pt-1">
                    <SignalStrip />
                  </span>
                </div>
                <h3 className="mt-5 text-base font-semibold tracking-tight text-white">{outcome.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/45">{outcome.description}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>

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
