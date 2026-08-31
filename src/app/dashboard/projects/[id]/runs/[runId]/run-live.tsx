"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  getRunSnapshotAction,
  retryRunFromDetail,
} from "./actions"
import type {
  RunDetailView,
  RunEventView,
  RunStatus,
} from "@/lib/dashboard/run-observability-core"
import { isTerminalStatus } from "@/lib/dashboard/run-observability-core"
import { RunStatusBadge } from "@/components/dashboard/run-status-badge"
import { RunEventTimeline } from "@/components/dashboard/run-event-timeline"

const POLL_INTERVAL_MS = 6000

export function RunLive({
  projectId,
  initialRun,
  initialEvents,
  canRun,
}: {
  projectId: string
  initialRun: RunDetailView
  initialEvents: RunEventView[]
  canRun: boolean
}) {
  const router = useRouter()
  const [run, setRun] = useState<RunDetailView>(initialRun)
  const [events, setEvents] = useState<RunEventView[]>(initialEvents)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const terminal = isTerminalStatus(run.status)

  useEffect(() => {
    if (terminal) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function tick() {
      try {
        const snapshot = await getRunSnapshotAction({ runId: run.id })
        if (cancelled || !snapshot?.detail) return
        setRun(snapshot.detail)
        if (snapshot.events?.length) setEvents(snapshot.events)
        if (isTerminalStatus(snapshot.detail.status as RunStatus)) return
      } catch {
        // Transient poll failure; keep the last known state and try again.
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [run.id, terminal])

  async function handleRetry() {
    setRetryError(null)
    setRetrying(true)
    try {
      const formData = new FormData()
      formData.set("runId", run.id)
      const newRunId = await retryRunFromDetail(formData)
      router.push(`/dashboard/projects/${projectId}/runs/${newRunId}`)
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Unable to queue a new run.")
      setRetrying(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <RunStatusBadge status={run.status} />
          <LiveHint status={run.status} />
        </div>
        {canRun ? (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="rounded-lg border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {retrying ? "Queueing…" : "Run again"}
          </button>
        ) : null}
      </div>

      {retryError ? (
        <p className="rounded-lg border border-red-300/20 bg-red-300/[.04] px-3 py-2 text-xs text-red-200">
          {retryError}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="font-semibold">Execution timeline</h2>
          <p className="mt-1 text-xs text-white/35">
            {events.length} event{events.length === 1 ? "" : "s"} recorded
          </p>
        </div>
        <div className="px-5 py-5">
          <RunEventTimeline events={events} />
        </div>
      </section>
    </div>
  )
}

function LiveHint({ status }: { status: RunStatus }) {
  switch (status) {
    case "queued":
      return <p className="text-xs text-white/45">Queued — dispatching shortly.</p>
    case "running":
      return <p className="text-xs text-white/45">Running — live updates enabled.</p>
    case "succeeded":
      return <p className="text-xs text-emerald-200/70">Completed successfully.</p>
    case "failed":
      return <p className="text-xs text-red-200/70">This execution did not complete.</p>
    case "cancelled":
      return <p className="text-xs text-white/40">This execution was cancelled.</p>
    default:
      return null
  }
}
