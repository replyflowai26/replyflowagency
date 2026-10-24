import type { CeoReport } from "@/lib/agents/ceo-report"
import { RUN_STATUS_META } from "@/lib/dashboard/run-observability-core"
import { formatRunEventTime } from "@/lib/dashboard/format-run-event-time"

// Server-rendered CEO report (task 62). Read-only by construction: no form, no
// action, no external call. Every number traces to a row this workspace could
// read; anything unavailable is labelled "Unknown" with its reason.

const GAP_TONE: Record<"unavailable" | "not-configured", string> = {
  unavailable: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  "not-configured": "border-white/15 bg-white/[.04] text-white/50",
}

const ACTION_TONE: Record<string, string> = {
  "restore-data": "border-amber-300/40 bg-amber-300/10",
  "resolve-approvals": "border-amber-300/40 bg-amber-300/10",
  "review-failures": "border-rose-300/30 bg-rose-300/10",
  "create-task": "border-cyan-300/30 bg-cyan-300/10",
  "run-task": "border-cyan-300/30 bg-cyan-300/10",
  idle: "border-white/10 bg-white/[.03]",
  monitor: "border-emerald-300/30 bg-emerald-300/10",
}

function Stat({
  label,
  value,
  caption,
  unknown,
}: {
  label: string
  value: number | null
  caption: string
  unknown: boolean
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[11px] uppercase tracking-[.14em] text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {unknown || value === null ? (
          <span className="text-base font-medium text-white/50">Unknown</span>
        ) : (
          value
        )}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-white/60">{caption}</p>
    </div>
  )
}

export function CeoReportPanel({
  report,
  errorMessage,
  timeZone,
}: {
  report: CeoReport | null
  errorMessage: string | null
  timeZone: string
}) {
  if (!report) {
    return (
      <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#090c12]/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
        <p className="text-xs uppercase tracking-[.18em] text-cyan-300">CEO report</p>
        <h2 className="mt-2 text-2xl font-semibold">Report unavailable.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
          {errorMessage ?? "The report could not be assembled in this environment."} No
          numbers are shown because no source could be read — nothing is estimated.
        </p>
      </section>
    )
  }

  const tasks = report.tasks
  const approvals = report.pendingApprovals
  const outcomes = report.recentOutcomes

  return (
    <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#090c12]/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-cyan-300">CEO report</p>
          <h2 className="mt-2 text-2xl font-semibold">What is actually happening.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
            Read-only summary of Jarvis tasks, approvals, workflow outcomes and the client
            pipeline. Sources that cannot be read are marked unknown — never zero, never
            simulated.
          </p>
        </div>
        <p className="w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] text-white/50">
          Generated {formatRunEventTime(report.generatedAt, timeZone)} · window{" "}
          {report.windowDays} days
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Tasks created"
          value={tasks.status === "available" ? tasks.data.counts.created : null}
          unknown={tasks.status === "unavailable"}
          caption={
            tasks.status === "available"
              ? "all recorded Jarvis tasks"
              : "task tables unavailable in this environment"
          }
        />
        <Stat
          label="Completed"
          value={tasks.status === "available" ? tasks.data.counts.succeeded : null}
          unknown={tasks.status === "unavailable"}
          caption="status = succeeded"
        />
        <Stat
          label="Failed"
          value={tasks.status === "available" ? tasks.data.counts.failed : null}
          unknown={tasks.status === "unavailable"}
          caption="status = failed; errors listed below"
        />
        <Stat
          label="Blocked on approval"
          value={tasks.status === "available" ? tasks.data.counts.blockedOnApproval : null}
          unknown={tasks.status === "unavailable"}
          caption="queued and waiting for a human decision"
        />
        <Stat
          label="Pending approvals"
          value={approvals.status === "available" ? approvals.data.total : null}
          unknown={approvals.status === "unavailable"}
          caption="both approval surfaces combined"
        />
      </div>

      <div className={`mt-5 rounded-2xl border p-5 ${ACTION_TONE[report.nextAction.kind] ?? ACTION_TONE.monitor}`}>
        <p className="text-[11px] uppercase tracking-[.16em] text-white/60">
          Next recommended action
        </p>
        <p className="mt-1 text-lg font-semibold">{report.nextAction.label}</p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-white/70">
          {report.nextAction.detail}
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[.16em] text-white/60">
              Pending approvals
            </p>
            <span className="text-[11px] text-white/50">
              responsible role: owner or admin
            </span>
          </div>
          {approvals.status === "unavailable" ? (
            <p className="mt-3 text-sm leading-5 text-amber-100">{approvals.reason}</p>
          ) : approvals.data.items.length === 0 ? (
            <p className="mt-3 text-sm leading-5 text-white/50">
              No pending approvals recorded.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {approvals.data.items.map((item) => (
                <li key={`${item.kind}:${item.id}`} className="rounded-xl border border-white/10 bg-white/[.02] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-100">
                      {item.kind === "agent-task" ? "Jarvis task" : "Workflow run"}
                    </span>
                    <span className="text-[11px] text-white/50">
                      waiting since {formatRunEventTime(item.createdAt, timeZone)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-white/80">{item.title}</p>
                  <p className="mt-1 text-[11px] text-white/50">
                    Approver: {item.approverRole}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {approvals.status === "available" && approvals.note ? (
            <p className="mt-3 text-[11px] leading-4 text-amber-100/80">{approvals.note}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[.16em] text-white/60">
              Recent workflow outcomes
            </p>
            <span className="text-[11px] text-white/50">
              {outcomes.status === "available"
                ? `${outcomes.data.failedInWindow} failed in window`
                : "unavailable"}
            </span>
          </div>
          {outcomes.status === "unavailable" ? (
            <p className="mt-3 text-sm leading-5 text-amber-100">{outcomes.reason}</p>
          ) : outcomes.data.items.length === 0 ? (
            <p className="mt-3 text-sm leading-5 text-white/50">
              No workflow runs recorded yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {outcomes.data.items.map((run) => {
                const meta = RUN_STATUS_META[run.status] ?? RUN_STATUS_META.failed
                return (
                  <li key={run.id} className="rounded-xl border border-white/10 bg-white/[.02] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] text-white/70">
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-white/50">
                        {formatRunEventTime(run.createdAt, timeZone)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-white/80">{run.workflowName}</p>
                    {run.errorCode || run.errorMessage ? (
                      <p className="mt-1 text-[11px] leading-4 text-rose-300/90">
                        {run.errorCode ? `${run.errorCode}: ` : ""}
                        {run.errorMessage ?? "No error message recorded."}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] uppercase tracking-[.16em] text-white/60">
            Client pipeline (recorded rows)
          </p>
          {report.pipeline.status === "unavailable" ? (
            <p className="mt-3 text-sm leading-5 text-amber-100">{report.pipeline.reason}</p>
          ) : (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {(
                  Object.entries(report.pipeline.data.counts) as [string, number][]
                ).map(([status, count]) => (
                  <div key={status} className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] capitalize text-white/50">{status}</dt>
                    <dd className="text-sm font-medium text-white/80">{count}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[11px] text-white/50">
                {report.pipeline.data.total} recorded client
                {report.pipeline.data.total === 1 ? "" : "s"} total.
              </p>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] uppercase tracking-[.16em] text-white/60">
            AI / API cost
          </p>
          <p className="mt-3 text-sm leading-5 text-white/60">{report.aiCosts.detail}</p>
          <span className="mt-3 inline-block rounded-full border border-white/15 bg-white/[.04] px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
            Not configured
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] uppercase tracking-[.16em] text-white/60">
            Notification channels
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {report.notifications.map((channel) => (
              <li key={channel.channel} className="flex items-center justify-between gap-2">
                <span className="text-[11px] capitalize text-white/60">{channel.channel}</span>
                <span className="rounded-full border border-white/15 bg-white/[.04] px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
                  Not built
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-4 text-white/50">
            No provider, credential or send path exists in this task.
          </p>
        </div>
      </div>

      {report.dataGaps.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] uppercase tracking-[.16em] text-white/60">
            Data gaps (shown as unknown, never estimated)
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {report.dataGaps.map((gap) => (
              <li key={gap.id} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                <span
                  className={`w-fit rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${GAP_TONE[gap.kind]}`}
                >
                  {gap.kind === "unavailable" ? "Unavailable" : "Not configured"}
                </span>
                <div>
                  <p className="text-xs font-medium text-white/75">{gap.label}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-white/50">{gap.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-[11px] leading-4 text-white/40">
        Counts are computed from rows this workspace can read; unavailable sources are shown
        as unknown. This report is read-only and never sends email, WhatsApp messages or calls.
      </p>
    </section>
  )
}
