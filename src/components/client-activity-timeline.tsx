import type { ClientActivity } from "@/types/client"

function activityStyle(activityType: string) {
  if (activityType === "client.status_changed") {
    return { dot: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,.6)]", border: "border-amber-300/20", label: "text-amber-200" }
  }
  if (activityType === "client.created") {
    return { dot: "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.6)]", border: "border-emerald-300/20", label: "text-emerald-200" }
  }
  if (activityType.startsWith("workflow_run.")) {
    return { dot: "bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.6)]", border: "border-cyan-300/20", label: "text-cyan-200" }
  }
  return { dot: "bg-violet-300 shadow-[0_0_14px_rgba(196,181,253,.5)]", border: "border-violet-300/20", label: "text-violet-200" }
}

export function ClientActivityTimeline({ activities }: { activities: ClientActivity[] }) {
  if (!activities.length) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm text-white/50">No activity recorded yet.</p>
        <p className="mt-1 text-xs text-white/25">Client actions and workflow associations will appear here.</p>
      </div>
    )
  }

  return (
    <ol className="divide-y divide-white/8">
      {activities.map((activity) => {
        const style = activityStyle(activity.activity_type)
        return (
          <li key={activity.id} className="flex gap-4 px-5 py-4">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white/80">{activity.title}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${style.border} ${style.label}`}>
                  {activity.activity_type.replace(/\./g, " ")}
                </span>
              </div>
              {activity.description ? <p className="mt-1 text-xs leading-5 text-white/40">{activity.description}</p> : null}
              <p className="mt-1.5 text-[10px] text-white/25">{new Date(activity.created_at).toLocaleString()}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
