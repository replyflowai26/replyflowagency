import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { humanizeRunId } from "@/lib/dashboard/run-observability"

type Props = { params: Promise<{ id: string }> }

export default async function ProjectRunsPage({ params }: Props) {
  const { id } = await params
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

  const { data: project } = await supabase
    .from("automation_projects")
    .select("id, name")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()

  if (!project) notFound()

  const { data: runs, error } = await supabase
    .from("workflow_runs")
    .select("id, workflow_id, client_id, clients(id, name), status, trigger_type, requested_by, external_execution_id, error_message, started_at, completed_at, created_at")
    .eq("project_id", id)
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) throw new Error("Unable to load workflow runs.")

  const workflowIds = [...new Set((runs ?? []).map((run) => run.workflow_id))]
  const { data: workflows } = workflowIds.length
    ? await supabase.from("workflows").select("id, name").in("id", workflowIds)
    : { data: [] as { id: string; name: string }[] }
  const workflowNames = new Map((workflows ?? []).map((workflow) => [workflow.id, workflow.name]))
  const runClients = new Map((runs ?? []).map((run) => {
    const client = Array.isArray(run.clients) ? run.clients[0] : run.clients
    return [run.id, client ? { id: client.id, name: client.name } : null]
  }))
  const runHrefs = new Map((runs ?? []).map((run) => [run.id, `/dashboard/projects/${id}/runs/${run.id}`]))

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[.2em] text-cyan-300">Automation observability</p>
        <h1 className="mt-1 text-2xl font-semibold">{project.name} runs</h1>
        <p className="mt-1 text-xs text-white/35">Durable workflow execution history</p>
      </div>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
          <div className="border-b border-white/8 px-5 py-4"><h2 className="font-semibold">Execution history</h2><p className="mt-1 text-xs text-white/35">Showing the latest {runs?.length ?? 0} runs.</p></div>
          {!runs?.length ? <div className="px-5 py-16 text-center"><p className="text-sm text-white/50">No workflow runs yet.</p><p className="mt-1 text-xs text-white/25">Runs will appear here once execution requests are created.</p></div> : <div className="divide-y divide-white/8">{runs.map((run) => { const client = runClients.get(run.id); const href = runHrefs.get(run.id); const statusTone = run.status === "failed" ? "text-red-300" : run.status === "succeeded" ? "text-emerald-200" : run.status === "running" ? "text-cyan-200" : "text-white/60"; return <Link key={run.id} href={href!} className="grid gap-3 px-5 py-5 transition hover:bg-white/[.02] md:grid-cols-[1.5fr_auto_auto_auto_auto] md:items-center"><div><h3 className="font-medium text-white/85">{workflowNames.get(run.workflow_id) ?? "Unknown workflow"}</h3><p className="mt-1 text-xs text-white/30">{humanizeRunId(run.id)}</p>{run.error_message ? <p className="mt-2 max-w-xl truncate text-xs text-red-300">{run.error_message}</p> : null}</div>{client ? <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.05] px-2.5 py-1 text-[10px] uppercase tracking-wider text-cyan-200">{client.name}</span> : null}<span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/50">{run.trigger_type}</span><span className={`rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider ${statusTone}`}>{run.status}</span><span className="text-xs text-white/30">{new Date(run.created_at).toLocaleString()}</span></Link>})}</div>}
        </section>
    </div>
  )
}
