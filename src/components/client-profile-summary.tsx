import type { ClientIntakeProfile } from "@/types/client-intake"

type Props = { profile: ClientIntakeProfile | null }

function formatBudget(profile: ClientIntakeProfile) {
  if (profile.monthly_budget === null) return "Not provided"
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: profile.budget_currency || "USD",
    maximumFractionDigits: 0,
  }).format(profile.monthly_budget)
}

export function ClientProfileSummary({ profile }: Props) {
  if (!profile) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/10 bg-[#090c12]/70 p-6 shadow-xl backdrop-blur-xl sm:p-8">
        <p className="text-xs uppercase tracking-[.18em] text-cyan-300">Client intelligence</p>
        <h2 className="mt-2 text-2xl font-semibold">Client profile not completed.</h2>
        <p className="mt-3 text-sm leading-6 text-white/40">Complete onboarding before designing automations. The profile becomes the source of truth for scope, budget and system requirements.</p>
      </section>
    )
  }

  const fields = [
    ["Contact", profile.contact_name],
    ["Industry", profile.industry || "Not provided"],
    ["Company size", profile.company_size || "Not provided"],
    ["Country / timezone", [profile.country, profile.timezone].filter(Boolean).join(" · ") || "Not provided"],
    ["Monthly budget", formatBudget(profile)],
    ["Timeline", profile.timeline || "Not provided"],
    ["Lead volume", profile.lead_volume || "Not provided"],
    ["Automation readiness", profile.automation_readiness || "Not provided"],
  ]

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#090c12]/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-cyan-300">Client intelligence</p>
          <h2 className="mt-2 text-2xl font-semibold">{profile.company_name}</h2>
          <p className="mt-2 text-sm text-white/40">{profile.website_url || "No website provided"}</p>
        </div>
        <span className="w-fit rounded-full border border-emerald-300/15 bg-emerald-300/[.05] px-3 py-1.5 text-xs text-emerald-200">Intake complete</span>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/8 bg-black/20 p-4">
            <p className="text-[10px] uppercase tracking-[.16em] text-white/25">{label}</p>
            <p className="mt-2 text-sm font-medium capitalize text-white/75">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-white/8 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[.16em] text-white/25">Primary goal</p>
          <p className="mt-3 text-sm leading-6 text-white/65">{profile.primary_goal || "Not provided"}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[.16em] text-white/25">Biggest problem</p>
          <p className="mt-3 text-sm leading-6 text-white/65">{profile.biggest_problem || "Not provided"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-white/8 bg-black/20 p-5 lg:col-span-2">
          <p className="text-xs uppercase tracking-[.16em] text-white/25">Requested services</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.requested_services.length ? profile.requested_services.map((item) => <span key={item} className="rounded-full border border-cyan-300/15 bg-cyan-300/[.05] px-3 py-1.5 text-xs text-cyan-100">{item}</span>) : <span className="text-sm text-white/35">Not provided</span>}
          </div>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[.16em] text-white/25">Current tools</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.current_tools.length ? profile.current_tools.map((item) => <span key={item} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-white/55">{item}</span>) : <span className="text-sm text-white/35">Not provided</span>}
          </div>
        </div>
      </div>
    </section>
  )
}
