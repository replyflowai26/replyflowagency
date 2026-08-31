import { cn } from "@/lib/utils"

export type KpiTone = "default" | "success" | "warning" | "muted"

type KpiCardProps = {
  label: string
  value: string
  caption: string
  tone?: KpiTone
  accent?: boolean
}

const toneClass: Record<KpiTone, string> = {
  default: "text-white",
  success: "text-emerald-200",
  warning: "text-amber-200",
  muted: "text-white/45",
}

export function KpiCard({
  label,
  value,
  caption,
  tone = "default",
  accent = false,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accent
          ? "border-cyan-300/15 bg-cyan-300/[.02]"
          : "border-white/8 bg-black/20",
      )}
    >
      <p className="text-[10px] uppercase tracking-[.18em] text-white/25">{label}</p>
      <p className={cn("mt-4 text-lg font-semibold leading-tight", toneClass[tone])}>
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-white/40">{caption}</p>
    </div>
  )
}
