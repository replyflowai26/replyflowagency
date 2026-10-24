import { Reveal } from "@/components/reveal";

const manualGaps = [
  { title: "Leads slip through", detail: "A new inquiry lands and nothing moves it — the response waits for someone to notice." },
  { title: "Follow-ups fall over", detail: "The sequence depends on memory, so the next touch never quite happens on time." },
  { title: "Context lives in silos", detail: "CRM, inbox and WhatsApp each hold half of the story — and re-typing it costs hours." },
  { title: "Nothing gets reported", detail: "The week disappears into busy work, and there is no signal for what needs attention." },
];

const systemEdge = [
  { title: "One operating loop", detail: "Capture, qualify, follow up, book, record and report — connected end to end." },
  { title: "The judgment stays human", detail: "Automation handles the routine. Decisions stay with your team." },
  { title: "It scales with volume", detail: "The same system absorbs more work without adding more manual hours." },
];

export function ProblemOpportunity() {
  return (
    <section id="problem" aria-labelledby="problem-opportunity-heading" className="relative overflow-hidden bg-paper">
      <div className="container py-16 sm:py-24">
        <Reveal>
          <div className="max-w-3xl">
            <p className="eyebrow">The problem / the opportunity</p>
            <h2
              id="problem-opportunity-heading"
              className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl"
            >
              Repetitive work feels busy — <span className="text-gradient-ink italic">and quietly costs the day.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
              The problem is rarely one big failure. It is the small gaps between tools — a lead that waits,
              a follow-up that slips, context that has to be re-typed. The opportunity is a system that closes
              those gaps for you.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          <Reveal>
            <article className="print-flat h-full rounded-2xl p-7 sm:p-9">
              <p className="font-mono text-[10px] tracking-[0.2em] text-ink-soft">The problem</p>
              <h3 className="mt-4 font-display text-2xl font-semibold text-ink sm:text-3xl">
                Work that depends on memory and haste
              </h3>
              <ul className="mt-7 space-y-6">
                {manualGaps.map((gap, index) => (
                  <li key={gap.title} className="flex gap-4">
                    <span className="pt-0.5 font-mono text-xs tracking-widest text-ink-soft">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{gap.title}</p>
                      <p className="mt-1 text-sm leading-6 text-ink-muted">{gap.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>

          <Reveal delay={0.1}>
            <article className="flex h-full flex-col rounded-2xl bg-ink p-7 text-paper sm:p-9">
              <div aria-hidden="true" className="h-px w-12 bg-[--blue]" />
              <p className="mt-5 font-mono text-[10px] tracking-[0.2em] text-paper/65">The opportunity</p>
              <h3 className="mt-4 font-display text-2xl font-semibold text-paper sm:text-3xl">
                One system keeps every step moving
              </h3>
              <ul className="mt-7 space-y-6">
                {systemEdge.map((edge, index) => (
                  <li key={edge.title} className="flex gap-4">
                    <span className="pt-0.5 font-mono text-xs tracking-widest text-[--blue]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-paper">{edge.title}</p>
                      <p className="mt-1 text-sm leading-6 text-paper/55">{edge.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-auto pt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/65">
                No survey promises — just systems that run
              </p>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}