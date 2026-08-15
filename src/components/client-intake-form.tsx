"use client"

import { useActionState } from "react"
import { saveClientIntake } from "@/app/onboarding/intake-actions"

const initialState: { error?: string } = {}
const services = ["Lead generation", "Customer support", "Sales automation", "CRM automation", "Marketing", "Scheduling", "Reporting & analytics", "Custom AI agent"]
const tools = ["WhatsApp", "Gmail", "Google Calendar", "HubSpot", "Salesforce", "Shopify", "Stripe", "Other"]
const channels = ["WhatsApp", "Email", "Instagram", "Website", "Phone", "Other"]

function Field({ label, name, placeholder, type = "text", required = false }: { label: string; name: string; placeholder?: string; type?: string; required?: boolean }) {
  return <label className="block"><span className="mb-2 block text-xs font-medium text-white/55">{label}{required ? " *" : ""}</span><input name={name} type={type} placeholder={placeholder} required={required} className="h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/[.05]" /></label>
}

export function ClientIntakeForm() {
  const [state, formAction, isPending] = useActionState(saveClientIntake, initialState)

  return <form action={formAction} className="space-y-7">
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Your name" name="contactName" placeholder="John Smith" required /><Field label="Company name" name="companyName" placeholder="Acme Inc." required /></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Website" name="websiteUrl" placeholder="https://company.com" type="url" /><Field label="Industry" name="industry" placeholder="E-commerce, SaaS, agency…" /></div>

    <div><p className="mb-3 text-xs font-medium text-white/55">Company size</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{["solo","2-10","11-50","51-200","201-500","500+"].map(v => <label key={v} className="cursor-pointer"><input className="peer sr-only" type="radio" name="companySize" value={v} /><span className="block rounded-xl border border-white/10 bg-black/20 px-2 py-2.5 text-center text-xs text-white/45 transition peer-checked:border-cyan-300/40 peer-checked:bg-cyan-300/[.08] peer-checked:text-cyan-200">{v}</span></label>)}</div></div>

    <div className="grid gap-4 sm:grid-cols-2"><Field label="Country" name="country" placeholder="India" /><Field label="Timezone" name="timezone" placeholder="Asia/Kolkata" /></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Monthly automation budget" name="monthlyBudget" placeholder="2500" type="number" /><label className="block"><span className="mb-2 block text-xs font-medium text-white/55">Currency</span><select name="budgetCurrency" defaultValue="USD" className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0e14] px-3.5 text-sm text-white outline-none focus:border-cyan-300/40"><option>USD</option><option>EUR</option><option>GBP</option><option>INR</option></select></label></div>

    <label className="block"><span className="mb-2 block text-xs font-medium text-white/55">What does your business do?</span><textarea name="businessDescription" rows={3} placeholder="Tell us what you sell, who you serve and how the business operates…" className="w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40" /></label>
    <label className="block"><span className="mb-2 block text-xs font-medium text-white/55">Primary goal</span><textarea name="primaryGoal" rows={2} placeholder="What outcome do you want from automation?" className="w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40" /></label>
    <label className="block"><span className="mb-2 block text-xs font-medium text-white/55">Biggest problem</span><textarea name="biggestProblem" rows={2} placeholder="What is currently slow, expensive or manual?" className="w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40" /></label>

    <div><p className="mb-3 text-xs font-medium text-white/55">Services you need</p><div className="grid gap-2 sm:grid-cols-2">{services.map(v => <label key={v} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-black/15 px-3 py-3 text-sm text-white/55 transition has-[:checked]:border-cyan-300/30 has-[:checked]:bg-cyan-300/[.05] has-[:checked]:text-white"><input type="checkbox" name="requestedServices" value={v} className="accent-cyan-300" />{v}</label>)}</div></div>
    <div><p className="mb-3 text-xs font-medium text-white/55">Current tools</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{tools.map(v => <label key={v} className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 bg-black/15 px-3 py-2.5 text-xs text-white/50 has-[:checked]:border-cyan-300/30 has-[:checked]:text-white"><input type="checkbox" name="currentTools" value={v} className="accent-cyan-300" />{v}</label>)}</div></div>
    <div><p className="mb-3 text-xs font-medium text-white/55">Lead / sales channels</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{channels.map(v => <label key={v} className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 bg-black/15 px-3 py-2.5 text-xs text-white/50 has-[:checked]:border-cyan-300/30 has-[:checked]:text-white"><input type="checkbox" name="salesChannels" value={v} className="accent-cyan-300" />{v}</label>)}</div></div>

    <div className="grid gap-4 sm:grid-cols-3"><label className="block"><span className="mb-2 block text-xs text-white/50">Timeline</span><select name="timeline" defaultValue="exploring" className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-sm text-white outline-none"><option value="asap">ASAP</option><option value="2-4-weeks">2–4 weeks</option><option value="1-3-months">1–3 months</option><option value="3-months+">3+ months</option><option value="exploring">Exploring</option></select></label><Field label="Lead volume / month" name="leadVolume" placeholder="e.g. 500" /><label className="block"><span className="mb-2 block text-xs text-white/50">Automation maturity</span><select name="automationReadiness" defaultValue="new" className="h-11 w-full rounded-xl border border-white/10 bg-[#0b0e14] px-3 text-sm text-white outline-none"><option value="new">Starting from scratch</option><option value="some-automation">Some automation</option><option value="advanced">Advanced</option></select></label></div>

    <label className="block"><span className="mb-2 block text-xs font-medium text-white/55">Anything else?</span><textarea name="notes" rows={3} placeholder="Anything our team should know before designing your system?" className="w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40" /></label>

    {state.error && <div className="rounded-xl border border-rose-300/15 bg-rose-300/[.06] px-3 py-2.5 text-sm text-rose-200" role="alert">{state.error}</div>}
    <button type="submit" disabled={isPending} className="h-12 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60">{isPending ? "Saving client profile…" : "Continue to workspace"}</button>
  </form>
}
