import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const userId = data.claims.sub;
  const email = typeof data.claims.email === "string" ? data.claims.email : "";

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations(id, name, slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen bg-[#050609] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <p className="text-xs font-medium tracking-[0.2em] text-cyan-300">REPLYFLOW AI</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Command Center</h1>
            <p className="mt-1 text-sm text-white/45">{email}</p>
          </div>
          <form action={signOut}>
            <button className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white" type="submit">
              Sign out
            </button>
          </form>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-white/45">Organizations</p>
            <p className="mt-2 text-3xl font-semibold">{memberships?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-white/45">Auth</p>
            <p className="mt-2 text-lg font-semibold text-emerald-300">Verified session</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-white/45">Foundation</p>
            <p className="mt-2 text-lg font-semibold">Multi-tenant core</p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Your organizations</h2>
              <p className="mt-1 text-sm text-white/45">Tenant access is controlled by Supabase RLS.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {memberships?.length ? memberships.map((membership) => {
              const organization = Array.isArray(membership.organizations)
                ? membership.organizations[0]
                : membership.organizations;

              return (
                <div key={membership.organization_id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-4">
                  <div>
                    <p className="font-medium">{organization?.name ?? "Organization"}</p>
                    <p className="text-sm text-white/40">{organization?.slug ?? membership.organization_id}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-white/60">
                    {membership.role}
                  </span>
                </div>
              );
            }) : (
              <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-white/45">
                No organization membership yet. The onboarding flow will create or invite you into a tenant next.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
