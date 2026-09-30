"use client"

import { useSyncExternalStore } from "react"
import type { RunEventView } from "@/lib/dashboard/run-observability-core"
import { formatRunEventTime } from "@/lib/dashboard/format-run-event-time"

const subscribe = () => () => {}

function LocalEventTime({ iso }: { iso: string }) {
  const displayTime = useSyncExternalStore(
    subscribe,
    () => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      return formatRunEventTime(iso, timeZone)
    },
    () => iso,
  )

  return <time dateTime={iso}>{displayTime}</time>
}

export function RunEventTimeline({ events }: { events: RunEventView[] }) {
  if (!events.length) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm text-white/50">No execution events recorded yet.</p>
        <p className="mt-1 text-xs text-white/25">
          Events will appear as the run progresses.
        </p>
      </div>
    )
  }

  return (
    <ol className="relative ml-3 space-y-0 border-l border-white/10">
      {events.map((event, index) => (
        <li key={`${event.createdAt}-${index}`} className="relative pb-5 pl-6 last:pb-0">
          <span
            aria-hidden="true"
            className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full border border-white/20 bg-[#090c12]"
          />
          <p className="text-sm font-medium text-white/85">{event.label}</p>
          {event.description ? (
            <p className="mt-0.5 text-xs leading-5 text-white/45">{event.description}</p>
          ) : null}
          <p className="mt-1 text-[10px] uppercase tracking-wider text-white/25">
            <LocalEventTime iso={event.createdAt} />
          </p>
        </li>
      ))}
    </ol>
  )
}
