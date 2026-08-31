import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

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

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#090c12]/80 px-5 py-4 backdrop-blur-xl">
          <div><p className="text-xs uppercase tracking-[.2em] text-cyan-300">Automation observability</p><h1 className="mt-1 text-2xl font-semibold">{project.name} runs</h1><p className="mt-1 text-xs text-white/35">Durable workflow execution history</p></div>
          <Link href={`/dashboard/projects/${project.id}`} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5">Back to project</Link>
        </header>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
          <div className="border-b border-white/8 px-5 py-4"><h2 className="font-semibold">Execution history</h2><p className="mt-1 text-xs text-white/35">Showing the latest {runs?.length ?? 0} runs.</p></div>
          {!runs?.length ? <div className="px-5 py-16 text-center"><p className="text-sm text-white/50">No workflow runs yet.</p><p className="mt-1 text-xs text-white/25">Runs will appear here once execution requests are created.</p></div> : <div className="divide-y divide-white/8">{runs.map((run) => { const client = runClients.get(run.id); return <div key={run.id} className="grid gap-3 px-5 py-5 md:grid-cols-[1.5fr_auto_auto_auto_auto] md:items-center"><div><h3 className="font-medium">{workflowNames.get(run.workflow_id) ?? "Unknown workflow"}</h3><p className="mt-1 text-xs text-white/30">{run.id}</p>{run.error_message ? <p className="mt-2 text-xs text-red-300">{run.error_message}</p> : null}</div>{client ? <Link href={`/dashboard/clients/${client.id}`} className="rounded-full border border-cyan-300/15 bg-cyan-300/[.05] px-2.5 py-1 text-[10px] uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-300/10">{client.name}</Link> : null}<span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/50">{run.trigger_type}</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/60">{run.status}</span><span className="text-xs text-white/30">{new Date(run.created_at).toLocaleString()}</span></div>})}</div>}
        </section>
      </div>
    </main>
  )
}
