import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ClientCreateForm } from "./client-create-form"
import { CLIENT_STATUSES, type Client, type ClientStatus } from "@/types/client"
import { isClientStatus } from "@/lib/leads/client-pipeline"

type ClientFilters = {
  status?: string
}

async function parseFilters(searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<ClientFilters> {
  const params = await searchParams
  const rawStatus = typeof params.status === "string" ? params.status : undefined
  if (rawStatus && isClientStatus(rawStatus)) return { status: rawStatus }
  return {}
}

function OutreachLabel(status: string) {
  return status.split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ")
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
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

  const filters = await parseFilters(searchParams)

  let query = supabase
    .from("clients")
    .select("id, organization_id, name, contact_name, email, phone, website_url, industry, status, source, notes, outreach_status, next_follow_up_at, owner_user_id, created_by, created_at, updated_at")
    .eq("organization_id", membership.organization_id)

  if (filters.status) query = query.eq("status", filters.status)
  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) throw new Error("Unable to load clients.")
  const clients = (data ?? []) as Client[]

  const activeCount = clients.filter((client) => client.status === "lead" || client.status === "prospect").length
  const followUpCount = clients.filter((client) => client.next_follow_up_at && client.outreach_status !== "closed_lost").length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="mt-1 text-sm text-white/40">Create and manage the operational client records in this workspace.</p>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-5">
          <p className="text-xs uppercase tracking-wider text-white/35">Open leads</p>
          <p className="mt-2 font-medium">{activeCount} active pipeline</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-5">
          <p className="text-xs uppercase tracking-wider text-white/35">Follow-ups</p>
          <p className="mt-2 font-medium">{followUpCount} scheduled</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-5">
          <p className="text-xs uppercase tracking-wider text-white/35">Total</p>
          <p className="mt-2 font-medium">{clients.length} client{clients.length === 1 ? "" : "s"}</p>
          {filters.status ? <p className="text-[10px] text-white/25">filtered by {filters.status}</p> : null}
        </div>
      </section>

      <section className="mb-6">
          <div className="mb-4"><h2 className="text-lg font-semibold">Add client</h2><p className="mt-1 text-sm text-white/40">Create the operational client record. Sensitive credentials do not belong here.</p></div>
          <ClientCreateForm />
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
          <div className="border-b border-white/8 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold">Client registry</h2><p className="mt-1 text-xs text-white/35">{clients.length} client{clients.length === 1 ? "" : "s"} in this workspace</p></div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href="/dashboard/clients" className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider transition ${!filters.status ? "border-white/20 bg-white/10 text-white" : "border-white/10 text-white/40 hover:text-white"}`}>All</Link>
                {CLIENT_STATUSES.filter((status) => status === "lead" || status === "prospect").map((status: ClientStatus) => <Link key={status} href={`/dashboard/clients?status=${status}`} className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider transition ${filters.status === status ? "border-white/20 bg-white/10 text-white" : "border-white/10 text-white/40 hover:text-white"}`}>{status}</Link>)}
              </div>
            </div>
          </div>
          {clients.length === 0 ? <div className="px-5 py-16 text-center"><p className="text-sm text-white/50">{filters.status ? `No clients with status "${filters.status}" yet.` : "No clients yet."}</p><p className="mt-1 text-xs text-white/25">{filters.status ? "Try another stage or clear the filter." : "Create the first client above."}</p></div> : <div className="divide-y divide-white/8">{clients.map((client) => <Link href={`/dashboard/clients/${client.id}`} key={client.id} className="grid gap-3 px-5 py-5 transition hover:bg-white/[0.025] sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{client.name}</h3><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-white/45">{client.status}</span>{client.outreach_status !== "not_started" ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2 py-1 text-[10px] uppercase tracking-wider text-cyan-200/80">{OutreachLabel(client.outreach_status)}</span> : null}</div><p className="mt-1 text-sm text-white/40">{client.contact_name ?? "No contact"}{client.industry ? ` · ${client.industry}` : ""}{client.next_follow_up_at ? ` · follow-up ${new Date(client.next_follow_up_at).toLocaleDateString()}` : ""}</p></div><div className="text-left text-xs text-white/35 sm:text-right"><p>{client.email ?? "No email"}</p><p className="mt-1">{client.source ?? "Direct"}</p></div></Link>)}</div>}
        </section>
    </div>
  )
}