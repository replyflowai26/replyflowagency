"use client";

import { motion } from "motion/react";

const steps = [
  ["01", "Audit", "Map the manual work and bottlenecks."],
  ["02", "Design", "Design the automation architecture."],
  ["03", "Build", "Connect AI, data and business tools."],
  ["04", "Optimize", "Measure, improve and scale the system."],
];

export function Process() {
  return (
    <motion.section
      id="process"
      className="border-y border-white/10 py-28"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7 }}
    >
      <div className="container">
        <p className="text-sm font-medium text-violet-300">OUR PROCESS</p>

        <div className="mt-12 grid gap-10 md:grid-cols-4">
          {steps.map(([number, title, description], index) => (
            <motion.article
              key={number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="text-sm text-white/30">{number}</div>
              <h3 className="mt-5 text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/50">
                {description}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
