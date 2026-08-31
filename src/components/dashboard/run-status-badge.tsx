import { cn } from "@/lib/utils"
import { RUN_STATUS_META, type RunStatus } from "@/lib/dashboard/run-observability-core"

const toneClasses: Record<RunStatus, string> = {
  queued: "border-white/15 text-white/70",
  running: "border-cyan-300/25 bg-cyan-300/[.06] text-cyan-200",
  succeeded: "border-emerald-300/25 bg-emerald-300/[.06] text-emerald-200",
  failed: "border-red-300/25 bg-red-300/[.06] text-red-200",
  cancelled: "border-white/10 text-white/50",
}

const dotPulse: Record<RunStatus, string> = {
  queued: "",
  running: "animate-pulse",
  succeeded: "",
  failed: "",
  cancelled: "",
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const meta = RUN_STATUS_META[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wider",
        toneClasses[status],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot, dotPulse[status])} />
      {meta.label}
    </span>
  )
}
