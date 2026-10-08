import { siteConfig } from "@/config/site";
import { Reveal } from "@/components/reveal";

const footerLinks = [
  { label: "Services", href: "#services" },
  { label: "Workflow", href: "#workflow" },
  { label: "Process", href: "#process" },
  { label: "Technology", href: "#tech-stack" },
  { label: "Contact", href: "#contact" },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-gradient-to-b from-transparent to-[#04060a] pt-10 pb-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -bottom-44 left-1/4 h-80 w-80 rounded-full bg-cyan-500/[0.05] blur-[110px]" />
        <div className="absolute -bottom-44 right-1/4 h-80 w-80 rounded-full bg-violet-500/[0.05] blur-[110px]" />
      </div>
      <div aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
      <div className="container relative">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <Reveal>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">{siteConfig.name}</p>
              <p className="mt-1 text-xs leading-5 text-white/35">AI automation systems for ambitious businesses.</p>
              <p className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                Systems operational
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
              {footerLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-white/45 transition-colors duration-200 hover:text-white/85"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </Reveal>
        </div>
        <div className="mt-9 flex flex-col gap-2 border-t border-white/[0.06] pt-5 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {siteConfig.name}</span>
          <span>AI Automation Systems</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em]">ReplyFlow OS</span>
        </div>
      </div>
    </footer>
  );
}