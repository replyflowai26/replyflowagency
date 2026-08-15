import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Client } from "@/types/client"
import { ClientEditForm } from "./client-edit-form"
import { ClientDeleteButton } from "./client-delete-button"

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()

  if (error) throw new Error("Unable to load client.")
  if (!data) notFound()

  const client = data as Client
  const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#090c12]/80 px-5 py-4 backdrop-blur-xl">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-cyan-300">Client operations</p>
            <h1 className="mt-1 text-2xl font-semibold">{client.name}</h1>
            <p className="mt-1 text-xs text-white/35">{organization?.name ?? "Workspace"}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/clients" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5">Back to clients</Link>
            <ClientDeleteButton clientId={client.id} />
          </div>
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
      </div>
    </main>
  )
}
