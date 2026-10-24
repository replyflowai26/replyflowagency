import type { ReactElement, SVGProps } from "react";
import { Reveal } from "@/components/reveal";

type ModuleIcon = (props: SVGProps<SVGSVGElement>) => ReactElement;

function CaptureIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><rect x="3" y="5" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M3 8.5h14" stroke="currentColor" strokeWidth="1.5" /><path d="M6.5 12.5h2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function RespondIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M10 3.5c3.6 0 6.5 2.7 6.5 6s-2.9 6-6.5 6c-.6 0-1.2-.08-1.8-.22L5 16.5l.6-2A5.8 5.8 0 0 1 3.5 9.5c0-3.3 2.9-6 6.5-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7.3 9.5h.01M10 9.5h.01M12.7 9.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function BookIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M6 3v3M14 3v3M3 8.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M6.5 14.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function TrackIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><ellipse cx="10" cy="5" rx="6" ry="2.4" stroke="currentColor" strokeWidth="1.5" /><path d="M4 5v5c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M4 10v5c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function ReportIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M4 16v-3.5M8.7 16V8.5M13.3 16V5.5M17 16H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

const osModules = [
  { name: "Capture", description: "Every channel — website, WhatsApp, email, forms — lands in one inbox.", tag: "BUILDING", Icon: CaptureIcon, tone: "text-blue-700", chip: "border-blue-600/30 text-blue-700", hairline: "group-hover:border-blue-600/40 group-hover:bg-blue-700/10" },
  { name: "Respond", description: "AI drafts the first reply in seconds; the decision stays with your team.", tag: "BUILDING", Icon: RespondIcon, tone: "text-indigo-700", chip: "border-indigo-600/30 text-indigo-700", hairline: "group-hover:border-indigo-600/40 group-hover:bg-indigo-700/10" },
  { name: "Book", description: "Scheduling handled without the back-and-forth of finding a time.", tag: "ROADMAP", Icon: BookIcon, tone: "text-sky-700", chip: "border-indigo-600/30 text-indigo-700", hairline: "group-hover:border-indigo-600/40 group-hover:bg-indigo-700/10" },
  { name: "Track", description: "The CRM stays current automatically, populated by every conversation.", tag: "BUILDING", Icon: TrackIcon, tone: "text-emerald-700", chip: "border-emerald-600/30 text-emerald-700", hairline: "group-hover:border-emerald-600/40 group-hover:bg-emerald-700/10" },
  { name: "Report", description: "Operational metrics become clear signals for what needs attention.", tag: "ROADMAP", Icon: ReportIcon, tone: "text-blue-700", chip: "border-blue-600/30 text-blue-700", hairline: "group-hover:border-blue-600/40 group-hover:bg-blue-700/10" },
];

export function CompanyOS() {
  return (
    <section id="os" aria-labelledby="os-heading" className="relative overflow-hidden bg-paper py-16 sm:py-24">
      <div className="container">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow mb-4 text-blue-ink">PRODUCT VISION</p>
            <h2 id="os-heading" className="font-display text-4xl font-semibold leading-[1.02] text-ink sm:text-5xl lg:text-6xl">
              ReplyFlow OS — the connective layer
              <span className="text-gradient-ink"> behind every system</span>
            </h2>
            <p className="mt-6 text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
              Capture, respond, book, track and report as one operating rhythm.
              We are building ReplyFlow OS as a product so every client system
              runs on the same coordinated core.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-line-ink bg-paper-lift px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
              In development — preview only, not yet operational
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {osModules.map((mod, index) => (
            <Reveal key={mod.name} delay={index * 0.06} className={index === osModules.length - 1 ? "sm:col-span-2 lg:col-span-1" : undefined}>
              <article className="plate-tile group relative flex h-full flex-col rounded-2xl p-5 transition-[border-color,box-shadow] duration-300 hover:border-blue-ink/40 hover:shadow-[0_18px_46px_rgba(4,8,18,0.12)]">
                <div className="flex items-center justify-between gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl border border-line-ink bg-paper transition-all duration-300 group-hover:-translate-y-1 ${mod.tone} ${mod.hairline}`}>
                    <mod.Icon className="h-5 w-5" />
                  </span>
                  <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] tracking-[0.14em] ${mod.chip}`}>{mod.tag}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight text-ink">{mod.name}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{mod.description}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.15}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-2xl border border-line-ink bg-paper-lift px-6 py-5 text-center sm:flex-row sm:gap-6">
            <p className="text-sm text-ink-muted">Running on the same operating core we build into every client system.</p>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-xl border border-blue-ink/30 bg-paper-lift px-4 py-2 text-sm font-semibold text-ink transition-colors duration-300 hover:border-blue-ink/50 hover:bg-paper-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-ink"
            >
              Start with one system <span aria-hidden="true">→</span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}