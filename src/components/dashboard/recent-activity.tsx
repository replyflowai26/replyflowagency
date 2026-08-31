import type { RecentActivityItem } from "@/lib/dashboard/telemetry"

function activityTone(activityType: string) {
  if (activityType === "client.status_changed") {
    return "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.5)]"
  }
  if (activityType === "client.created") {
    return "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.5)]"
  }
  if (activityType.startsWith("workflow_run.")) {
    return "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.5)]"
  }
  return "bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,.45)]"
}

export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  if (!items.length) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="font-semibold">Recent activity</h2>
          <p className="mt-1 text-xs text-white/35">Latest client operations in this workspace</p>
        </div>
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-white/50">No recent activity yet.</p>
          <p className="mt-1 text-xs text-white/25">Client actions and workflow associations will appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
        <div>
          <h2 className="font-semibold">Recent activity</h2>
          <p className="mt-1 text-xs text-white/35">Latest client operations in this workspace</p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/40">
          {items.length} recent
        </span>
      </div>
      <ol className="divide-y divide-white/8">
        {items.map((activity) => (
          <li key={activity.id} className="flex gap-4 px-5 py-4">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${activityTone(activity.activityType)}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/80">{activity.title}</p>
              {activity.description ? (
                <p className="mt-1 text-xs leading-5 text-white/40">{activity.description}</p>
              ) : null}
              <p className="mt-1.5 text-[10px] text-white/25">
                {new Date(activity.createdAt).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
