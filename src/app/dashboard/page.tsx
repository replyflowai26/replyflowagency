import { redirect } from "next/navigation"
import { InviteMemberForm } from "@/components/invite-member-form"
import { signOut } from "./actions"
import { createClient } from "@/lib/supabase/server"

type MembershipRow = {
  organization_id: string
  role: "owner" | "admin" | "member" | "viewer"
  organizations:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
    | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (claimsError || !userId) {
    redirect("/login")
  }

  const { data, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations(name, slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (membershipError) {
    throw new Error("Unable to load workspace membership.")
  }

  const membership = (data as MembershipRow[] | null)?.[0]

  if (!membership) {
    redirect("/onboarding")
  }

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations

  if (!organization) {
    throw new Error("Workspace organization could not be loaded.")
  }

  const canInvite = membership.role === "owner" || membership.role === "admin"

  return (
    <main className="min-h-screen bg-[#050609] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm tracking-widest text-cyan-300">REPLYFLOW AI · COMPANY OS</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{organization.name}</h1>
            <p className="mt-2 text-white/50">/{organization.slug} · {membership.role}</p>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-cyan-100"
            >
              Sign out
            </button>
          </form>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 backdrop-blur-xl">
            <p className="text-sm text-white/40">Workspace foundation</p>
            <h2 className="mt-2 text-2xl font-semibold">Authentication is production-wired.</h2>
            <p className="mt-3 max-w-2xl text-white/50">
              Sessions are verified server-side, refreshed through Next.js Proxy, and all organization data remains protected by Supabase RLS.
            </p>
          </div>

          {canInvite ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 backdrop-blur-xl">
              <p className="text-sm text-white/40">Team access</p>
              <h2 className="mt-2 text-2xl font-semibold">Invite a teammate.</h2>
              <p className="mt-3 text-white/50">Owners and admins can invite members or viewers.</p>
              <InviteMemberForm organizationId={membership.organization_id} />
            </div>
          ) : (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 backdrop-blur-xl">
              <p className="text-sm text-white/40">Team access</p>
              <h2 className="mt-2 text-2xl font-semibold">Read-only membership.</h2>
              <p className="mt-3 text-white/50">Your current role is {membership.role}. Ask an owner or admin to manage invitations.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
