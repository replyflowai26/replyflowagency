"use client";

import { motion } from "motion/react";
import { siteConfig } from "@/config/site";

export function CTA() {
  return (
    <motion.section
      id="contact"
      className="py-28"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7 }}
    >
      <div className="container">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-8 sm:p-14">
          <p className="text-sm font-medium tracking-tight text-cyan-300">
            READY WHEN YOU ARE
          </p>

          <h2 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Let&apos;s automate the work your team shouldn&apos;t be doing manually.
          </h2>

          <p className="mt-8 max-w-2xl text-base leading-7 text-white/55">
            Tell us what is repetitive, slow or leaking revenue. We&apos;ll map
            the system before recommending a build.
          </p>

          <motion.a
            href={`mailto:${siteConfig.email}`}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-8 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black"
          >
            Start a conversation
          </motion.a>
        </div>
      </div>
    </motion.section>
  );
}
