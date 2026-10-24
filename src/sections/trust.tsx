import { Reveal } from "@/components/reveal";

const capabilities = ["AI Automation", "Lead Generation", "Sales Automation", "Customer Support", "Operations", "Reporting", "Custom AI Systems"];

export function Trust() {
  const marquee = [...capabilities, ...capabilities];
  return (
    <section aria-label="Capabilities" className="chapter-ink relative overflow-hidden border-y border-white/10">
      <div aria-hidden="true" className="rule-warm absolute bottom-0 left-8 right-8" />
      <div className="container relative py-8">
        <Reveal>
          <p className="mb-5 text-center font-mono text-[.67rem] font-semibold uppercase tracking-[.2em] text-white/55">
            Connected systems, not isolated tools
          </p>
          <div className="relative flex w-full overflow-hidden" aria-hidden="true">
            <div className="marquee-line flex min-w-max items-center gap-8">
              {marquee.map((capability, index) => (
                <span key={`${capability}-${index}`} className="flex items-center gap-8 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">
                  <span className="h-1 w-1 rounded-full bg-[--blue]" />
                  {capability}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}