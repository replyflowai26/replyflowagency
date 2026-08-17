import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

type Props = { params: Promise<{ id: string }> }

type RunRow = {
  id: string
  workflow_id: string
  status: string
  trigger_type: string
  error_message: string | null
  external_execution_id: string | null
  created_at: string
}

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
    .select("id, workflow_id, status, trigger_type, error_message, external_execution_id, created_at")
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
  const runRows = (runs ?? []) as RunRow[]

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#090c12]/80 px-5 py-4 backdrop-blur-xl">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-cyan-300">Automation observability</p>
            <h1 className="mt-1 text-2xl font-semibold">{project.name} runs</h1>
            <p className="mt-1 text-xs text-white/35">Durable workflow execution history</p>
          </div>
          <Link href={`/dashboard/projects/${project.id}`} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5">
            Back to project
          </Link>
        </header>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 className="font-semibold">Execution history</h2>
            <p className="mt-1 text-xs text-white/35">Showing the latest {runRows.length} runs.</p>
          </div>
          {!runRows.length ? (
            <div className="px-5 py-16 text-center">
              <p className="text-sm text-white/50">No workflow runs yet.</p>
              <p className="mt-1 text-xs text-white/25">Runs will appear here once execution requests are created.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/8">
              {runRows.map((run) => (
                <Link
                  key={run.id}
                  href={`/dashboard/projects/${project.id}/runs/${run.id}`}
                  className="grid gap-3 px-5 py-5 transition hover:bg-white/[0.025] md:grid-cols-[1.5fr_auto_auto_auto] md:items-center"
                >
                  <div>
                    <h3 className="font-medium">{workflowNames.get(run.workflow_id) ?? "Unknown workflow"}</h3>
                    <p className="mt-1 text-xs text-white/30">{run.id}</p>
                    {run.error_message ? <p className="mt-2 text-xs text-red-300">{run.error_message}</p> : null}
                  </div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/50">{run.trigger_type}</span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/60">{run.status}</span>
                  <span className="text-xs text-white/30">{new Date(run.created_at).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
