import type { ReactElement, SVGProps } from "react";
import { Reveal } from "@/components/reveal";

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

type WorkflowNode = {
  title: string;
  detail: string;
  tag: string;
  Icon: IconComponent;
  dot: string;
  iconTone: string;
  iconHover: string;
};

function LeadIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><circle cx="10" cy="6.2" r="2.6" stroke="currentColor" strokeWidth="1.6" /><path d="M4.5 15.5c0-2.2 2.5-3.4 5.5-3.4s5.5 1.2 5.5 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function AIIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M10 2.6 11.7 8.3 17.4 10 11.7 11.7 10 17.4 8.3 11.7 2.6 10 8.3 8.3 10 2.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}

function CRMIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><ellipse cx="10" cy="5" rx="6" ry="2.4" stroke="currentColor" strokeWidth="1.6" /><path d="M4 5v5c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M4 10v5c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4v-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function MailIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><rect x="3" y="5" width="14" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.6" /><path d="m4.2 7.6 5.8 3.8 5.8-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" /><path d="M10 6.6V10l2.5 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function ChartIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M4.5 15.5v-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M9.5 15.5V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M14.5 15.5V4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M3 15.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

const workflowNodes: WorkflowNode[] = [
  { title: "Lead", detail: "Captured from any channel", tag: "INPUT", Icon: LeadIcon, dot: "bg-blue-600", iconTone: "text-blue-700", iconHover: "group-hover:border-blue-700/30 group-hover:bg-blue-700/10" },
  { title: "AI Processing", detail: "Qualify, enrich, score", tag: "LOGIC", Icon: AIIcon, dot: "bg-indigo-600", iconTone: "text-indigo-700", iconHover: "group-hover:border-indigo-700/30 group-hover:bg-indigo-700/10" },
  { title: "CRM", detail: "Structured with context", tag: "STATE", Icon: CRMIcon, dot: "bg-sky-600", iconTone: "text-sky-700", iconHover: "group-hover:border-sky-700/30 group-hover:bg-sky-700/10" },
  { title: "WhatsApp / Email", detail: "Personal outreach", tag: "CHANNEL", Icon: MailIcon, dot: "bg-blue-600", iconTone: "text-blue-700", iconHover: "group-hover:border-blue-700/30 group-hover:bg-blue-700/10" },
  { title: "Follow-up", detail: "Timed for conversion", tag: "SEQUENCE", Icon: ClockIcon, dot: "bg-sky-600", iconTone: "text-sky-700", iconHover: "group-hover:border-sky-700/30 group-hover:bg-sky-700/10" },
  { title: "Reporting", detail: "Pipeline visibility", tag: "OUTPUT", Icon: ChartIcon, dot: "bg-emerald-600", iconTone: "text-emerald-700", iconHover: "group-hover:border-emerald-700/30 group-hover:bg-emerald-700/10" },
];

function ChevronRight(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" {...props}><path d="m4 2.5 4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// Coordinated "where work is now" highlight: the six knots light in sequence,
// ~1.4s apart on an 8.4s loop, matching the hero's signal rhythm. Decorative
// only (labels carry meaning) and hidden entirely under reduced motion.
const nodeRingDelay = ["-8.40s", "-7.08s", "-5.68s", "-4.28s", "-2.88s", "-1.48s"]

function WorkflowStep({ node, index, hasNext }: { node: WorkflowNode; index: number; hasNext: boolean }) {
  const nodeDelay = `${(index * 0.55).toFixed(2)}s`;
  const connectorDelay = `${(index * 0.55 + 0.28).toFixed(2)}s`;

  return (
    <li className="group flex w-full flex-col items-center xl:w-auto xl:flex-1 xl:flex-row xl:items-stretch xl:self-stretch">
      <article className="plate-tile flex h-full w-full max-w-md flex-col rounded-2xl p-5 text-left transition-[border-color,background-color,box-shadow] duration-300 hover:border-blue-ink/40 hover:shadow-[0_16px_44px_rgba(9,14,26,0.12)] xl:max-w-none">
        <span className="node-ring" aria-hidden="true" style={{ animationDelay: nodeRingDelay[index] }} />
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] tracking-[0.18em] text-ink-soft">
            {String(index + 1).padStart(2, "0")} · {node.tag}
          </span>
          <span
            className={`pulse-dot h-1.5 w-1.5 shrink-0 rounded-full ${node.dot}`}
            style={{ animationDelay: nodeDelay }}
            aria-hidden="true"
          />
        </div>

        <span className={`mt-4 grid h-10 w-10 place-items-center rounded-xl border border-line-ink bg-paper transition-colors duration-300 ${node.iconTone} ${node.iconHover}`}>
          <node.Icon className="h-5 w-5" />
        </span>

        <div className="mt-4">
          <h3 className="text-sm font-semibold leading-tight tracking-tight text-ink">{node.title}</h3>
          <p className="mt-1 text-[11px] leading-4 text-ink-muted">{node.detail}</p>
        </div>

        <div className="mt-auto pt-4">
          <div className="relative h-px w-full overflow-hidden bg-line-ink" aria-hidden="true">
            <span className="absolute inset-0 origin-left scale-x-0 bg-blue-ink transition-transform duration-500 ease-out group-hover:scale-x-100" />
          </div>
          <p className="mt-2 text-[11px] tracking-[0.16em] text-ink-soft transition-colors duration-300 group-hover:text-blue-ink">
            AUTOMATED HANDOFF
          </p>
        </div>
      </article>

      {hasNext && (
        <>
          <div aria-hidden="true" className="relative flex h-7 w-px flex-col items-center bg-gradient-to-b from-line-ink to-line-ink-strong transition-colors duration-300 group-hover:from-blue-ink/60 group-hover:to-blue-ink/30 md:hidden">
            <span className="workflow-pulse workflow-pulse-v" style={{ animationDelay: connectorDelay }} />
            <ChevronRight className="absolute -bottom-1 h-2.5 w-2.5 rotate-90 text-ink-soft transition-colors duration-300 group-hover:text-blue-ink" />
          </div>
          <div aria-hidden="true" className="relative hidden w-7 items-center self-center bg-transparent xl:flex">
            <span className="h-px flex-1 bg-gradient-to-r from-line-ink to-line-ink-strong transition-colors duration-300 group-hover:from-blue-ink/60 group-hover:to-blue-ink/30" />
            <span className="workflow-pulse" style={{ animationDelay: connectorDelay }} />
            <ChevronRight className="-mr-1 h-2.5 w-2.5 shrink-0 text-ink-soft transition-colors duration-300 group-hover:text-blue-ink" />
          </div>
        </>
      )}
    </li>
  );
}

export function Workflow() {
  return (
    <section id="workflow" aria-labelledby="workflow-heading" className="chapter-ink relative overflow-hidden py-16 sm:py-24">
      <div className="container relative">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow-light mb-4">How the automation runs</p>
            <h2 id="workflow-heading" className="font-display text-4xl font-semibold leading-[1.02] text-white sm:text-5xl lg:text-6xl">
              Every lead moves through <span className="text-gradient">one connected system</span>
            </h2>
            <p className="mt-6 leading-7 text-white/70 sm:text-lg sm:leading-8">
              ReplyFlow links the tools your business already uses and automates the hand-offs between them —
              from first touch to weekly reporting.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="relative mt-14 overflow-hidden rounded-[2rem] border border-line-ink bg-paper-lift px-5 py-8 shadow-[0_1px_0_rgba(11,14,21,0.04),0_18px_44px_rgba(4,8,18,0.14)] sm:px-8 sm:py-10 xl:px-10">
            <div aria-hidden="true" className="rule-warm absolute bottom-0 left-16 right-16 opacity-60" />

            <div className="relative mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-line-ink pb-4">
              <span className="flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-ink-soft">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-blue-ink" aria-hidden="true" />
                AUTOMATION RUNTIME
              </span>
              <span className="font-mono text-[11px] tracking-[0.18em] text-ink-soft">01 → 06 · LIVE</span>
            </div>

            <ol className="relative grid list-none grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-row xl:items-stretch xl:gap-0">
              {workflowNodes.map((node, index) => (
                <WorkflowStep key={node.title} node={node} index={index} hasNext={index < workflowNodes.length - 1} />
              ))}
            </ol>

            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-line-ink pt-4 text-[11px] tracking-[0.18em] text-ink-soft">
              <span>NO MANUAL HANDOFFS</span>
              <span className="hidden h-3 w-px bg-line-ink sm:block" aria-hidden="true" />
              <span>EVERY STEP CONNECTED</span>
              <span className="hidden h-3 w-px bg-line-ink sm:block" aria-hidden="true" />
              <span>HUMAN DECISION GATES</span>
              <span className="hidden h-3 w-px bg-line-ink sm:block" aria-hidden="true" />
              <span>END TO END</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}