import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WorkflowCreateForm } from "./workflow-create-form"
import { WorkflowRunButton } from "./workflow-run-button"

type Props = { params: Promise<{ id: string }> }
type Membership = { organization_id: string; role: "owner" | "admin" | "member" | "viewer" }

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) redirect("/login")

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (membershipError || !membership) redirect("/onboarding")
  const workspace = membership as Membership

  const { data: project, error: projectError } = await supabase
    .from("automation_projects")
    .select("id, name, slug, description, status, created_at")
    .eq("id", id)
    .eq("organization_id", workspace.organization_id)
    .maybeSingle()
  if (projectError) throw new Error("Unable to load project.")
  if (!project) notFound()

  const { data: workflows, error: workflowsError } = await supabase
    .from("workflows")
    .select("id, name, description, status, created_at, updated_at")
    .eq("project_id", id)
    .eq("organization_id", workspace.organization_id)
    .order("created_at", { ascending: false })
  if (workflowsError) throw new Error("Unable to load workflows.")

  const { data: recentRuns, error: runsError } = await supabase
    .from("workflow_runs")
    .select("id, workflow_id, status, trigger_type, created_at, started_at, completed_at, error_message")
    .eq("project_id", id)
    .eq("organization_id", workspace.organization_id)
    .order("created_at", { ascending: false })
    .limit(20)
  if (runsError) throw new Error("Unable to load workflow runs.")

  const canCreate = ["owner", "admin", "member"].includes(workspace.role)
  const workflowNames = new Map((workflows ?? []).map((workflow) => [workflow.id, workflow.name]))

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#090c12]/80 px-5 py-4 backdrop-blur-xl">
          <div><p className="text-xs uppercase tracking-[.2em] text-cyan-300">Automation project</p><h1 className="mt-1 text-2xl font-semibold">{project.name}</h1><p className="mt-1 text-xs text-white/35">/{project.slug}</p></div>
          <Link href="/dashboard/projects" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5">Back to projects</Link>
        </header>

        <section className="mb-6 rounded-2xl border border-white/10 bg-[#090c12]/80 p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs uppercase tracking-[.18em] text-white/30">Project overview</p><p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">{project.description ?? "No project description has been provided."}</p></div>
            <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[.04] px-3 py-1.5 text-xs uppercase tracking-wider text-emerald-200">{project.status}</span>
          </div>
        </section>

        {canCreate ? <section className="mb-6 rounded-2xl border border-white/10 bg-[#090c12]/80 p-5 backdrop-blur-xl"><h2 className="font-semibold">Create workflow</h2><p className="mt-1 mb-5 text-sm text-white/40">Add a workflow definition to this project. Only active workflows can be queued for execution.</p><WorkflowCreateForm projectId={project.id} /></section> : null}

        <section className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
          <div className="border-b border-white/8 px-5 py-4"><h2 className="font-semibold">Workflow registry</h2><p className="mt-1 text-xs text-white/35">{workflows?.length ?? 0} workflow{workflows?.length === 1 ? "" : "s"}</p></div>
          {!workflows?.length ? <div className="px-5 py-16 text-center"><p className="text-sm text-white/50">No workflows yet.</p><p className="mt-1 text-xs text-white/25">Create the first workflow above.</p></div> : <div className="divide-y divide-white/8">{workflows.map((workflow) => <div key={workflow.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5"><div><h3 className="font-medium">{workflow.name}</h3><p className="mt-1 text-sm text-white/40">{workflow.description ?? "No description"}</p></div><div className="flex items-center gap-3"><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/45">{workflow.status}</span><WorkflowRunButton projectId={project.id} workflowId={workflow.id} disabled={workflow.status !== "active" || !canCreate} /></div></div>)}</div>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
          <div className="border-b border-white/8 px-5 py-4"><h2 className="font-semibold">Execution history</h2><p className="mt-1 text-xs text-white/35">Latest 20 durable execution records</p></div>
          {!recentRuns?.length ? <div className="px-5 py-16 text-center"><p className="text-sm text-white/50">No executions yet.</p><p className="mt-1 text-xs text-white/25">Activate a workflow and use Run now to create the first queue record.</p></div> : <div className="divide-y divide-white/8">{recentRuns.map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-medium">{workflowNames.get(run.workflow_id) ?? "Unknown workflow"}</p><p className="mt-1 text-xs text-white/35">{run.trigger_type} · {new Date(run.created_at).toLocaleString()}</p>{run.error_message ? <p className="mt-1 text-xs text-red-300">{run.error_message}</p> : null}</div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/50">{run.status}</span></div>)}</div>}
        </section>
      </div>
    </main>
  )
}
