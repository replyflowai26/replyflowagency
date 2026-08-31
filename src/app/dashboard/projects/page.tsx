import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProjectCreateForm } from "./project-create-form"

type Project = { id: string; name: string; slug: string; description: string | null; status: string; created_at: string }

type Membership = { organization_id: string; role: "owner" | "admin" | "member" | "viewer"; organizations: { name: string } | { name: string }[] | null }

export default async function ProjectsPage() {
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
    .from("automation_projects")
    .select("id, name, slug, description, status, created_at")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })

  if (error) throw new Error("Unable to load projects.")
  const projects = (data ?? []) as Project[]
  const canCreate = ["owner", "admin", "member"].includes(membership.role)

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("organization_id", membership.organization_id)
    .order("name", { ascending: true })

  const clientOptions = (clients ?? []).map((client) => ({ id: client.id, name: client.name }))

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="mt-1 text-sm text-white/40">Automation projects group related workflows into one operational unit.</p>
      </div>

      {canCreate ? <section className="mb-6 rounded-2xl border border-white/10 bg-[#090c12]/80 p-5 backdrop-blur-xl"><h2 className="font-semibold">Create automation project</h2><p className="mt-1 mb-5 text-sm text-white/40">Projects group related workflows into one operational unit.</p><ProjectCreateForm clients={clientOptions} /></section> : null}

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
          <div className="border-b border-white/8 px-5 py-4"><h2 className="font-semibold">Project registry</h2><p className="mt-1 text-xs text-white/35">{projects.length} project{projects.length === 1 ? "" : "s"} in this workspace</p></div>
          {projects.length === 0 ? <div className="px-5 py-16 text-center"><p className="text-sm text-white/50">No automation projects yet.</p><p className="mt-1 text-xs text-white/25">Create the first project to start organizing workflows.</p></div> : <div className="divide-y divide-white/8">{projects.map((project) => <Link key={project.id} href={`/dashboard/projects/${project.id}`} className="block px-5 py-5 transition hover:bg-white/[.025]"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-medium">{project.name}</h3><p className="mt-1 text-sm text-white/40">{project.description ?? "No description"}</p></div><span className="rounded-full border border-emerald-300/15 bg-emerald-300/[.04] px-2.5 py-1 text-[10px] uppercase tracking-wider text-emerald-200">{project.status}</span></div></Link>)}</div>}
        </section>
    </div>
  )
}
