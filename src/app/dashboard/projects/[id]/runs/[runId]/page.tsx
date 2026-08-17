import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

type Props = {
  params: Promise<{ id: string; runId: string }>
}

type RunEvent = {
  id: string
  event_type: string
  message: string | null
  payload: Record<string, unknown>
  created_at: string
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function statusClass(status: string) {
  switch (status) {
    case "succeeded":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
    case "failed":
      return "border-red-400/20 bg-red-400/10 text-red-300"
    case "running":
      return "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
    case "cancelled":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300"
    default:
      return "border-white/10 bg-white/5 text-white/60"
  }
}

export default async function WorkflowRunDetailPage({ params }: Props) {
  const { id, runId } = await params
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) redirect("/login")

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) redirect("/onboarding")

  const { data: run, error: runError } = await supabase
    .from("workflow_runs")
    .select(
      "id, workflow_id, project_id, status, trigger_type, requested_by, external_execution_id, input, output, error_code, error_message, started_at, completed_at, created_at, updated_at",
    )
    .eq("id", runId)
    .eq("project_id", id)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()

  if (runError) throw new Error("Unable to load workflow run.")
  if (!run) notFound()

  const [{ data: project }, { data: workflow }, { data: events, error: eventsError }] =
    await Promise.all([
      supabase
        .from("automation_projects")
        .select("id, name")
        .eq("id", id)
        .eq("organization_id", membership.organization_id)
        .maybeSingle(),
      supabase
        .from("workflows")
        .select("id, name, status")
        .eq("id", run.workflow_id)
        .eq("organization_id", membership.organization_id)
        .maybeSingle(),
      supabase
        .from("workflow_run_events")
        .select("id, event_type, message, payload, created_at")
        .eq("run_id", run.id)
        .eq("organization_id", membership.organization_id)
        .order("created_at", { ascending: true }),
    ])

  if (!project) notFound()
  if (eventsError) throw new Error("Unable to load workflow run events.")

  const runEvents = (events ?? []) as RunEvent[]
  const durationMs = run.started_at
    ? new Date(run.completed_at ?? new Date().toISOString()).getTime() - new Date(run.started_at).getTime()
    : null

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-white/10 bg-[#090c12]/80 px-5 py-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[.2em] text-cyan-300">Automation observability</p>
              <h1 className="mt-1 text-2xl font-semibold">Workflow run</h1>
              <p className="mt-1 text-sm text-white/40">{workflow?.name ?? "Unknown workflow"} · {project.name}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dashboard/projects/${project.id}/runs`}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
              >
                Back to runs
              </Link>
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
              >
                Project
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-4">
            <p className="text-[10px] uppercase tracking-[.18em] text-white/30">Status</p>
            <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${statusClass(run.status)}`}>
              {run.status}
            </span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-4">
            <p className="text-[10px] uppercase tracking-[.18em] text-white/30">Trigger</p>
            <p className="mt-3 text-sm text-white/80">{run.trigger_type}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-4">
            <p className="text-[10px] uppercase tracking-[.18em] text-white/30">Duration</p>
            <p className="mt-3 text-sm text-white/80">
              {durationMs === null ? "Not started" : `${Math.max(0, durationMs)} ms`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-4">
            <p className="text-[10px] uppercase tracking-[.18em] text-white/30">Events</p>
            <p className="mt-3 text-sm text-white/80">{runEvents.length}</p>
          </div>
        </section>

        {run.error_message ? (
          <section className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-5">
            <p className="text-xs uppercase tracking-[.18em] text-red-300">Execution error</p>
            <p className="mt-2 text-sm text-red-100/80">{run.error_message}</p>
            {run.error_code ? <p className="mt-2 font-mono text-xs text-red-300/70">{run.error_code}</p> : null}
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-2xl border border-white/10 bg-[#090c12]/80">
            <div className="border-b border-white/8 px-5 py-4">
              <h2 className="font-semibold">Execution timeline</h2>
              <p className="mt-1 text-xs text-white/35">Append-only events recorded for this run.</p>
            </div>
            {!runEvents.length ? (
              <div className="px-5 py-12 text-center text-sm text-white/40">No execution events recorded.</div>
            ) : (
              <div className="divide-y divide-white/8">
                {runEvents.map((event) => (
                  <article key={event.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/60">
                        {event.event_type}
                      </span>
                      <time className="text-[11px] text-white/25" dateTime={event.created_at}>
                        {new Date(event.created_at).toLocaleString()}
                      </time>
                    </div>
                    <p className="mt-3 text-sm text-white/70">{event.message ?? "No event message."}</p>
                    {Object.keys(event.payload ?? {}).length ? (
                      <pre className="mt-3 overflow-x-auto rounded-xl border border-white/8 bg-black/20 p-3 text-[11px] leading-5 text-white/40">
                        {formatValue(event.payload)}
                      </pre>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-5">
              <h2 className="font-semibold">Run metadata</h2>
              <dl className="mt-4 space-y-3 text-xs">
                <div><dt className="text-white/25">Run ID</dt><dd className="mt-1 break-all font-mono text-white/55">{run.id}</dd></div>
                <div><dt className="text-white/25">Workflow ID</dt><dd className="mt-1 break-all font-mono text-white/55">{run.workflow_id}</dd></div>
                <div><dt className="text-white/25">External execution</dt><dd className="mt-1 break-all font-mono text-white/55">{run.external_execution_id ?? "—"}</dd></div>
                <div><dt className="text-white/25">Created</dt><dd className="mt-1 text-white/55">{new Date(run.created_at).toLocaleString()}</dd></div>
                <div><dt className="text-white/25">Completed</dt><dd className="mt-1 text-white/55">{run.completed_at ? new Date(run.completed_at).toLocaleString() : "—"}</dd></div>
              </dl>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-5">
              <h2 className="font-semibold">Input</h2>
              <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-white/8 bg-black/20 p-3 text-[11px] leading-5 text-white/45">
                {formatValue(run.input)}
              </pre>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-5">
              <h2 className="font-semibold">Output</h2>
              <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-white/8 bg-black/20 p-3 text-[11px] leading-5 text-white/45">
                {formatValue(run.output)}
              </pre>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
