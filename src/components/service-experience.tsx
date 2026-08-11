"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

type Service = {
  number: string;
  title: string;
  description: string;
  steps: string[];
};

const services: Service[] = [
  {
    number: "01",
    title: "Lead Generation",
    description: "Capture, enrich and route qualified leads automatically.",
    steps: ["Find leads", "Enrich data", "AI qualification", "CRM routing", "Follow-up"],
  },
  {
    number: "02",
    title: "Sales Automation",
    description: "Qualify prospects and keep follow-ups moving automatically.",
    steps: ["New prospect", "AI qualification", "Personalized outreach", "Follow-up", "Booked meeting"],
  },
  {
    number: "03",
    title: "Customer Support",
    description: "Give customers fast, consistent AI-assisted support.",
    steps: ["Customer message", "AI understands", "Knowledge lookup", "Response", "Escalation"],
  },
  {
    number: "04",
    title: "Operations",
    description: "Connect repetitive business tasks into reliable workflows.",
    steps: ["Trigger", "Process data", "AI decision", "Automation", "Complete"],
  },
  {
    number: "05",
    title: "Reporting",
    description: "Turn operational data into useful decision signals.",
    steps: ["Collect data", "Analyze", "AI insights", "Report", "Decision"],
  },
  {
    number: "06",
    title: "Custom AI Systems",
    description: "Design an AI system around the way your business works.",
    steps: ["Audit", "Architecture", "Build", "Integrate", "Optimize"],
  },
];

export function ServiceExperience() {
  const [selected, setSelected] = useState<Service | null>(null);

  return (
    <>
      <section id="services" className="border-t border-white/10 py-28">
        <div className="container">
          <div className="mb-12 max-w-3xl">
            <p className="mb-4 text-sm font-medium tracking-widest text-cyan-300">
              WHAT WE BUILD
            </p>

            <h2 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
              One automation layer for the work that slows you down.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {services.map((service) => (
              <motion.button
                key={service.number}
                type="button"
                onClick={() => setSelected(service)}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.99 }}
                className="group rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-left transition-colors hover:border-cyan-300/30 hover:bg-white/[0.055]"
              >
                <span className="text-sm text-white/35">{service.number}</span>

                <h3 className="mt-12 text-2xl font-semibold text-white">
                  {service.title}
                </h3>

                <p className="mt-3 max-w-md text-base leading-7 text-white/55">
                  {service.description}
                </p>

                <span className="mt-8 inline-block text-sm font-medium text-cyan-300 opacity-70 transition-opacity group-hover:opacity-100">
                  Explore system →
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.35 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d0e12] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                <div>
                  <p className="text-xs tracking-widest text-cyan-300">
                    AI SYSTEM
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold text-white">
                    {selected.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="p-6 md:p-10">
                <div className="mb-8 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.025] p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    {selected.steps.map((step, index) => (
                      <motion.div
                        key={step}
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.15 }}
                        className="flex items-center gap-3"
                      >
                        <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white">
                          {step}
                        </div>

                        {index < selected.steps.length - 1 && (
                          <span className="text-cyan-300/60">→</span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                <p className="max-w-2xl text-lg leading-8 text-white/60">
                  {selected.description} The system connects AI, business data
                  and automation into one measurable workflow.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
