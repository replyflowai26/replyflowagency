import type { ReactElement, SVGProps } from "react";
import { Reveal } from "@/components/reveal";

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

type WorkflowNode = {
  title: string;
  detail: string;
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
  { title: "Lead", detail: "Captured from any channel", Icon: LeadIcon },
  { title: "AI Processing", detail: "Qualify, enrich, score", Icon: AIIcon },
  { title: "CRM", detail: "Structured with context", Icon: CRMIcon },
  { title: "WhatsApp / Email", detail: "Personal outreach", Icon: MailIcon },
  { title: "Follow-up", detail: "Timed for conversion", Icon: ClockIcon },
  { title: "Reporting", detail: "Pipeline visibility", Icon: ChartIcon },
];

function WorkflowStep({ node, index, hasNext }: { node: WorkflowNode; index: number; hasNext: boolean }) {
  return (
    <li className="group flex w-full flex-col items-center xl:w-auto xl:flex-1 xl:flex-row xl:items-stretch xl:self-stretch">
      <article className="flex h-full w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-colors duration-300 hover:border-cyan-300/30 hover:bg-white/[0.05]">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200/90 transition-colors duration-300 group-hover:border-cyan-300/30 group-hover:bg-cyan-300/10">
          <node.Icon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold leading-tight tracking-tight text-white">{node.title}</h3>
          <p className="mt-1 text-[11px] leading-4 text-white/40">{node.detail}</p>
        </div>
      </article>
      {hasNext && (
        <>
          <div aria-hidden="true" className="relative h-6 w-px bg-gradient-to-b from-white/15 to-white/25 transition-colors duration-300 group-hover:from-cyan-300/40 group-hover:to-cyan-300/25 xl:hidden">
            <span className="workflow-pulse workflow-pulse-v" style={{ animationDelay: `${index * 0.3}s` }} />
          </div>
          <div aria-hidden="true" className="relative hidden h-px w-6 self-center bg-gradient-to-r from-white/15 to-white/25 transition-colors duration-300 group-hover:from-cyan-300/40 group-hover:to-cyan-300/25 xl:block">
            <span className="workflow-pulse" style={{ animationDelay: `${index * 0.3}s` }} />
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
            <p className="eyebrow mb-4">Automation in motion</p>
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
            <ol className="relative flex list-none flex-col items-center xl:flex-row xl:items-stretch">
              {workflowNodes.map((node, index) => (
                <WorkflowStep key={node.title} node={node} index={index} hasNext={index < workflowNodes.length - 1} />
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}