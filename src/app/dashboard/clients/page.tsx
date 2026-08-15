import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ClientCreateForm } from "./client-create-form"
import type { Client } from "@/types/client"

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) redirect("/login")

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) redirect("/onboarding")

  const { data, error } = await supabase
    .from("clients")
    .select("id, organization_id, name, contact_name, email, phone, website_url, industry, status, source, notes, owner_user_id, created_by, created_at, updated_at")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })

  if (error) throw new Error("Unable to load clients.")
  const clients = (data ?? []) as Client[]
  const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between rounded-2xl border border-white/10 bg-[#090c12]/80 px-5 py-4 backdrop-blur-xl">
          <div><p className="text-xs uppercase tracking-[.2em] text-cyan-300">Client operations</p><h1 className="mt-1 text-2xl font-semibold">Clients</h1><p className="mt-1 text-xs text-white/35">{organization?.name ?? "Workspace"}</p></div>
          <a href="/dashboard" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5">Dashboard</a>
        </header>

        <section className="mb-6">
          <div className="mb-4"><h2 className="text-lg font-semibold">Add client</h2><p className="mt-1 text-sm text-white/40">Create the operational client record. Sensitive credentials do not belong here.</p></div>
          <ClientCreateForm />
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4"><div><h2 className="font-semibold">Client registry</h2><p className="mt-1 text-xs text-white/35">{clients.length} client{clients.length === 1 ? "" : "s"} in this workspace</p></div></div>
          {clients.length === 0 ? <div className="px-5 py-16 text-center"><p className="text-sm text-white/50">No clients yet.</p><p className="mt-1 text-xs text-white/25">Create the first client above.</p></div> : <div className="divide-y divide-white/8">{clients.map((client) => <article key={client.id} className="grid gap-3 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{client.name}</h3><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-white/45">{client.status}</span></div><p className="mt-1 text-sm text-white/40">{client.contact_name ?? "No contact"}{client.industry ? ` · ${client.industry}` : ""}</p></div><div className="text-left text-xs text-white/35 sm:text-right"><p>{client.email ?? "No email"}</p><p className="mt-1">{client.source ?? "Direct"}</p></div></article>)}</div>}
        </section>
      </div>
    </main>
  )
}
