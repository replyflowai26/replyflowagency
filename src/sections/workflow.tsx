import type { ReactElement, SVGProps } from "react";
import { Reveal } from "@/components/reveal";

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

type WorkflowNode = {
  title: string;
  detail: string;
  tag: string;
  Icon: IconComponent;
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
  { title: "Lead", detail: "Captured from any channel", tag: "INPUT", Icon: LeadIcon },
  { title: "AI Processing", detail: "Qualify, enrich, score", tag: "LOGIC", Icon: AIIcon },
  { title: "CRM", detail: "Structured with context", tag: "STATE", Icon: CRMIcon },
  { title: "WhatsApp / Email", detail: "Personal outreach", tag: "CHANNEL", Icon: MailIcon },
  { title: "Follow-up", detail: "Timed for conversion", tag: "SEQUENCE", Icon: ClockIcon },
  { title: "Reporting", detail: "Pipeline visibility", tag: "OUTPUT", Icon: ChartIcon },
];

function ChevronRight(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" {...props}><path d="m4 2.5 4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function WorkflowStep({ node, index, hasNext }: { node: WorkflowNode; index: number; hasNext: boolean }) {
  const nodeDelay = `${(index * 0.55).toFixed(2)}s`;
  const connectorDelay = `${(index * 0.55 + 0.28).toFixed(2)}s`;

  return (
    <li className="group flex w-full flex-col items-center xl:w-auto xl:flex-1 xl:flex-row xl:items-stretch xl:self-stretch">
      <article className="flex h-full w-full max-w-md flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-[border-color,background-color,box-shadow] duration-300 hover:border-cyan-300/35 hover:bg-white/[0.055] hover:shadow-[0_18px_50px_rgba(34,211,238,0.10)] xl:max-w-none">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] tracking-[0.18em] text-white/30">
            {String(index + 1).padStart(2, "0")} · {node.tag}
          </span>
          <span
            className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300"
            style={{ animationDelay: nodeDelay }}
            aria-hidden="true"
          />
        </div>

        <span className="mt-4 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200/90 transition-colors duration-300 group-hover:border-cyan-300/30 group-hover:bg-cyan-300/10">
          <node.Icon className="h-5 w-5" />
        </span>

        <div className="mt-4">
          <h3 className="text-sm font-semibold leading-tight tracking-tight text-white">{node.title}</h3>
          <p className="mt-1 text-[11px] leading-4 text-white/40">{node.detail}</p>
        </div>

        <div className="mt-auto pt-4">
          <div className="relative h-px w-full overflow-hidden bg-white/10" aria-hidden="true">
            <span className="absolute inset-0 origin-left scale-x-0 bg-cyan-300/70 transition-transform duration-500 ease-out group-hover:scale-x-100" />
          </div>
          <p className="mt-2 text-[10px] tracking-[0.16em] text-white/0 transition-colors duration-300 group-hover:text-cyan-200/80">
            AUTOMATED HANDOFF
          </p>
        </div>
      </article>

      {hasNext && (
        <>
          <div aria-hidden="true" className="relative flex h-7 w-px flex-col items-center bg-gradient-to-b from-white/15 to-white/25 transition-colors duration-300 group-hover:from-cyan-300/50 group-hover:to-cyan-300/25 xl:hidden">
            <span className="workflow-pulse workflow-pulse-v" style={{ animationDelay: connectorDelay }} />
            <ChevronRight className="absolute -bottom-1 h-2.5 w-2.5 rotate-90 text-white/25 transition-colors duration-300 group-hover:text-cyan-300/80" />
          </div>
          <div aria-hidden="true" className="relative hidden w-7 items-center self-center bg-transparent xl:flex">
            <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-white/25 transition-colors duration-300 group-hover:from-cyan-300/50 group-hover:to-cyan-300/25" />
            <span className="workflow-pulse" style={{ animationDelay: connectorDelay }} />
            <ChevronRight className="-mr-1 h-2.5 w-2.5 shrink-0 text-white/25 transition-colors duration-300 group-hover:text-cyan-300/80" />
          </div>
        </>
      )}
    </li>
  );
}

export function Workflow() {
  return (
    <section id="workflow" aria-labelledby="workflow-heading" className="relative overflow-hidden py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.07),transparent_30rem)]" />
      <div className="container relative">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow mb-4">HOW THE AUTOMATION RUNS</p>
            <h2 id="workflow-heading" className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Every lead moves through <span className="text-gradient">one connected system</span>
            </h2>
            <p className="mt-6 leading-7 text-white/60 sm:text-lg sm:leading-8">
              ReplyFlow links the tools your business already uses and automates the hand-offs between them —
              from first touch to weekly reporting.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="relative mt-14 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] px-5 py-8 sm:px-8 sm:py-10 xl:px-10">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(124,58,237,0.08),transparent_55%)]" />

            <div className="relative mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <span className="flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-white/50">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan-300" aria-hidden="true" />
                AUTOMATION RUNTIME
              </span>
              <span className="font-mono text-[10px] tracking-[0.18em] text-white/30">01 → 06 · LIVE</span>
            </div>

            <ol className="relative flex list-none flex-col items-center xl:flex-row xl:items-stretch">
              {workflowNodes.map((node, index) => (
                <WorkflowStep key={node.title} node={node} index={index} hasNext={index < workflowNodes.length - 1} />
              ))}
            </ol>

            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-[10px] tracking-[0.18em] text-white/30">
              <span>NO MANUAL HANDOFFS</span>
              <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
              <span>EVERY STEP CONNECTED</span>
              <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
              <span>END TO END</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
