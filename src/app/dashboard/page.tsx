import { redirect } from "next/navigation"
import { InviteMemberForm } from "@/components/invite-member-form"
import { ClientProfileSummary } from "@/components/client-profile-summary"
import type { ClientIntakeProfile } from "@/types/client-intake"
import { createClient } from "@/lib/supabase/server"
import { getDashboardTelemetry } from "@/lib/dashboard/telemetry"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { RecentActivity } from "@/components/dashboard/recent-activity"

type MembershipRow = { organization_id: string; role: "owner" | "admin" | "member" | "viewer"; organizations: { name: string; slug: string } | { name: string; slug: string }[] | null }

function formatPercent(rate: number | null): string | null {
  if (rate === null) return null
  return `${Math.round(rate * 100)}%`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) redirect("/login")

  const { data, error: membershipError } = await supabase.from("organization_memberships").select("organization_id, role, organizations(name, slug)").eq("user_id", userId).order("created_at", { ascending: true })
  if (membershipError) throw new Error("Unable to load workspace membership.")
  const membership = (data as MembershipRow[] | null)?.[0]
  if (!membership) redirect("/onboarding")
  const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations
  if (!organization) throw new Error("Workspace organization could not be loaded.")
  const canInvite = membership.role === "owner" || membership.role === "admin"

  let telemetry: Awaited<ReturnType<typeof getDashboardTelemetry>> | null = null
  let telemetryError: string | null = null
  try {
    telemetry = await getDashboardTelemetry(membership.organization_id)
  } catch (error) {
    telemetryError = error instanceof Error ? error.message : "Unable to load dashboard data."
  }

  const { data: clientProfile } = await supabase.from("client_intake_profiles").select("organization_id, contact_name, company_name, website_url, industry, company_size, country, timezone, business_description, primary_goal, biggest_problem, current_tools, requested_services, monthly_budget, budget_currency, timeline, lead_volume, sales_channels, automation_readiness, notes, intake_completed_at, created_at, updated_at").eq("organization_id", membership.organization_id).maybeSingle()

  const windowLabel = telemetry ? `last ${telemetry.windowDays} days` : "recently"

  const successRateValue = telemetry ? (formatPercent(telemetry.runStats.successRate) ?? "No data") : "—"
  const successTone: "default" | "success" | "warning" | "muted" = telemetry && telemetry.runStats.successRate !== null
    ? (telemetry.runStats.successRate < 0.7 ? "warning" : "success")
    : "muted"
  const successCaption = telemetry && telemetry.runStats.successRate !== null
    ? `across ${telemetry.runStats.finalized} finalized ${telemetry.runStats.finalized === 1 ? "run" : "runs"} in the ${windowLabel}`
    : `no finalized runs in the ${windowLabel}`

  const attentionTone: "default" | "success" | "warning" | "muted" = telemetry
    ? (telemetry.runStats.failed > 0 ? "warning" : "success")
    : "default"
  const attentionCaption = telemetry
    ? telemetry.runStats.failed > 0
      ? `failed ${telemetry.runStats.failed === 1 ? "run" : "runs"} in the ${windowLabel} — check execution history`
      : `no failed runs in the ${windowLabel}`
    : "executions in the last 30 days"

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(124,58,237,.14),transparent_30rem),radial-gradient(circle_at_90%_60%,rgba(34,211,238,.08),transparent_28rem)]" />
      <div className="relative">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.035] p-6 shadow-2xl backdrop-blur-xl sm:p-8 lg:p-10"><div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" /><div className="relative"><div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-[.2em] text-cyan-300">Workspace overview</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">{organization.name}</h1><p className="mt-3 text-sm text-white/40">/{organization.slug} · {membership.role}</p></div><span className="w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/50">Production workspace</span></div><div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {telemetry ? (
            <>
              <KpiCard label="Total clients" value={`${telemetry.totalClients}`} caption={`${telemetry.totalClients === 1 ? "client" : "clients"} across your workspace`} accent />
              <KpiCard label="Active automations" value={`${telemetry.activeWorkflows}`} caption={`${telemetry.activeWorkflows === 1 ? "workflow is" : "workflows are"} active right now`} />
              <KpiCard label="Run success rate" value={successRateValue} caption={successCaption} tone={successTone} />
              <KpiCard label="Attention needed" value={`${telemetry.runStats.failed}`} caption={attentionCaption} tone={attentionTone} />
            </>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4 sm:col-span-2 lg:col-span-4">
              <p className="text-sm font-medium text-amber-200">Dashboard telemetry is unavailable right now.</p>
              <p className="mt-1 text-xs leading-5 text-white/40">{telemetryError ?? "We could not load your workspace metrics. Please try again shortly."}</p>
            </div>
          )}
        </div></div></section>

        <section className="mt-5"><ClientProfileSummary profile={(clientProfile as ClientIntakeProfile | null) ?? null} /></section>

        <section className="mt-5"><RecentActivity items={telemetry?.recentActivities ?? []} /></section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_.8fr]"><div className="rounded-[2rem] border border-white/10 bg-[#090c12]/80 p-6 shadow-xl backdrop-blur-xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-white/30">System foundation</p><h2 className="mt-2 text-2xl font-semibold">Your operating layer is connected.</h2></div><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,.8)]" /></div><p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">Authentication is server-verified, workspace membership is role-aware, and organization data is isolated through Supabase policies. This is the foundation for clients, automations, reporting and the full Company OS.</p></div>{canInvite ? <div className="rounded-[2rem] border border-white/10 bg-[#090c12]/80 p-6 shadow-xl backdrop-blur-xl sm:p-8"><p className="text-xs uppercase tracking-[.18em] text-cyan-300">Team access</p><h2 className="mt-2 text-2xl font-semibold">Invite your team.</h2><p className="mt-3 text-sm leading-6 text-white/40">Owners and admins can add members or viewers to this workspace.</p><InviteMemberForm organizationId={membership.organization_id} /></div> : <div className="rounded-[2rem] border border-white/10 bg-[#090c12]/80 p-6 shadow-xl backdrop-blur-xl sm:p-8"><p className="text-xs uppercase tracking-[.18em] text-white/30">Team access</p><h2 className="mt-2 text-2xl font-semibold">Your role is {membership.role}.</h2><p className="mt-3 text-sm leading-6 text-white/40">Ask an owner or admin to manage workspace invitations.</p></div>}</section>
      </div>
    </div>
  )
}
