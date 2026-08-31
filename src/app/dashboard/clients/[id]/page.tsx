import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Client, ClientActivity } from "@/types/client"
import { ClientEditForm } from "./client-edit-form"
import { ClientDeleteButton } from "./client-delete-button"
import { ClientActivityTimeline } from "@/components/client-activity-timeline"

type Membership = {
  organization_id: string
  role: "owner" | "admin" | "member" | "viewer"
  organizations: { name: string } | { name: string }[] | null
}

type AssignedProject = {
  id: string
  name: string
  slug: string
  status: string
  description: string | null
}

type RunRow = {
  id: string
  workflow_id: string
  status: string
  trigger_type: string
  created_at: string
  error_message: string | null
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) redirect("/login")

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membershipData) redirect("/onboarding")
  const membership = membershipData as Membership

  const { data, error } = await supabase
    .from("clients")
    .select("id, organization_id, name, contact_name, email, phone, website_url, industry, status, source, notes, owner_user_id, created_by, created_at, updated_at")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()

  if (error) throw new Error("Unable to load client.")
  if (!data) notFound()

  const client = data as Client

  const [projectsResult, runsResult, activitiesResult] = await Promise.all([
    supabase
      .from("automation_projects")
      .select("id, name, slug, status, description")
      .eq("client_id", client.id)
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("workflow_runs")
      .select("id, workflow_id, status, trigger_type, created_at, error_message")
      .eq("client_id", client.id)
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("client_activities")
      .select("id, organization_id, client_id, activity_type, title, description, actor_user_id, metadata, created_at")
      .eq("client_id", client.id)
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  const projects = (projectsResult.data ?? []) as AssignedProject[]
  const runs = (runsResult.data ?? []) as RunRow[]
  const activities = (activitiesResult.data ?? []) as ClientActivity[]

  const workflowIds = [...new Set(runs.map((run) => run.workflow_id))]
  const { data: workflows } = workflowIds.length
    ? await supabase.from("workflows").select("id, name, project_id").in("id", workflowIds)
    : { data: [] as { id: string; name: string; project_id: string }[] }
  const workflowMap = new Map((workflows ?? []).map((workflow) => [workflow.id, workflow]))
  const projectNameMap = new Map(projects.map((project) => [project.id, project.name]))

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="mt-1 text-xs text-white/35">Client workspace record</p>
        </div>
        <ClientDeleteButton clientId={client.id} />
      </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-5">
            <p className="text-xs uppercase tracking-wider text-white/35">Status</p>
            <p className="mt-2 font-medium capitalize">{client.status}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-5">
            <p className="text-xs uppercase tracking-wider text-white/35">Industry</p>
            <p className="mt-2 font-medium">{client.industry ?? "Not specified"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-5">
            <p className="text-xs uppercase tracking-wider text-white/35">Source</p>
            <p className="mt-2 font-medium">{client.source ?? "Direct"}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Client details</h2>
            <p className="mt-1 text-sm text-white/40">Update operational information. Credentials and API secrets must remain in integrations.</p>
          </div>
          <ClientEditForm client={client} />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
            <div className="border-b border-white/8 px-5 py-4">
              <h2 className="font-semibold">Assigned automation projects</h2>
              <p className="mt-1 text-xs text-white/35">{projects.length} project{projects.length === 1 ? "" : "s"}</p>
            </div>
            {!projects.length ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-white/50">No projects assigned yet.</p>
                <Link href="/dashboard/projects" className="mt-2 inline-block text-xs text-cyan-200 hover:text-cyan-100">Create a project for this client</Link>
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {projects.map((project) => (
                  <Link key={project.id} href={`/dashboard/projects/${project.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-white/[.025]">
                    <div>
                      <h3 className="font-medium">{project.name}</h3>
                      <p className="mt-1 text-xs text-white/35">{project.description ?? "No description"}</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/45">{project.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
            <div className="border-b border-white/8 px-5 py-4">
              <h2 className="font-semibold">Recent workflow runs</h2>
              <p className="mt-1 text-xs text-white/35">Latest {runs.length} executions for this client</p>
            </div>
            {!runs.length ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-white/50">No workflow runs for this client yet.</p>
                <p className="mt-1 text-xs text-white/25">Run a workflow with this client selected to populate history.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {runs.map((run) => {
                  const workflow = workflowMap.get(run.workflow_id)
                  return (
                    <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div>
                        <h3 className="text-sm font-medium">{workflow?.name ?? "Unknown workflow"}</h3>
                        <p className="mt-1 text-xs text-white/35">
                          {projectNameMap.get(workflow?.project_id ?? "") ?? "General"} · {run.trigger_type}
                        </p>
                        {run.error_message ? <p className="mt-1 text-xs text-red-300">{run.error_message}</p> : null}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/50">{run.status}</span>
                        <span className="text-[10px] text-white/25">{new Date(run.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 className="font-semibold">Client activity</h2>
            <p className="mt-1 text-xs text-white/35">Append-only record of client operations</p>
          </div>
          <ClientActivityTimeline activities={activities} />
        </section>
    </div>
  )
}
