import { redirect } from "next/navigation"
import { createOrganization } from "./actions"
import { createClient } from "@/lib/supabase/server"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/login")
  }

  const { count } = await supabase
    .from("organization_memberships")
    .select("organization_id", { count: "exact", head: true })

  if ((count ?? 0) > 0) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050609] px-6 text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-sm tracking-widest text-cyan-300">REPLYFLOW AI</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Create your first organization.</h1>
        <p className="mt-3 text-white/50">This becomes your isolated Company OS workspace.</p>

        <form className="mt-8 space-y-4" action={createOrganization}>
          <input
            name="name"
            placeholder="Organization name"
            autoComplete="organization"
            required
            minLength={2}
            maxLength={120}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
          />
          <input
            name="slug"
            placeholder="organization-slug"
            autoComplete="off"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            maxLength={80}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-cyan-100"
          >
            Create organization
          </button>
        </form>
      </section>
    </main>
  )
}
