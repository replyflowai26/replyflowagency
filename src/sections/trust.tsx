import { Reveal } from "@/components/reveal";

const capabilities = ["AI Automation", "Lead Generation", "Sales Automation", "Customer Support", "Operations", "Reporting", "Custom AI Systems"];
export function Trust() { return <section aria-label="Capabilities" className="border-y border-white/10 bg-white/[.018]"><div className="container py-7"><Reveal><p className="mb-4 text-[.67rem] font-semibold uppercase tracking-[.16em] text-white/40">Connected systems, not isolated tools</p><div className="flex flex-wrap gap-x-6 gap-y-3">{capabilities.map((capability) => <span key={capability} className="text-sm font-medium text-white/70 sm:text-base">{capability}</span>)}</div></Reveal></div></section>; }
