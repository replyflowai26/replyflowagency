"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

type IntakeState = { error?: string }

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim()
}

function list(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value).trim()).filter(Boolean)
}

export async function saveClientIntake(_previous: IntakeState, formData: FormData): Promise<IntakeState> {
  const contactName = clean(formData.get("contactName"))
  const companyName = clean(formData.get("companyName"))
  const websiteUrl = clean(formData.get("websiteUrl")) || null
  const industry = clean(formData.get("industry")) || null
  const companySize = clean(formData.get("companySize")) || null
  const country = clean(formData.get("country")) || null
  const timezone = clean(formData.get("timezone")) || null
  const businessDescription = clean(formData.get("businessDescription")) || null
  const primaryGoal = clean(formData.get("primaryGoal")) || null
  const biggestProblem = clean(formData.get("biggestProblem")) || null
  const monthlyBudgetRaw = clean(formData.get("monthlyBudget"))
  const budgetCurrency = clean(formData.get("budgetCurrency")) || "USD"
  const timeline = clean(formData.get("timeline")) || null
  const leadVolume = clean(formData.get("leadVolume")) || null
  const automationReadiness = clean(formData.get("automationReadiness")) || null
  const notes = clean(formData.get("notes")) || null

  if (contactName.length < 2 || companyName.length < 2) {
    return { error: "Please enter your name and company name." }
  }

  const monthlyBudget = monthlyBudgetRaw ? Number(monthlyBudgetRaw) : null
  if (monthlyBudget !== null && (!Number.isFinite(monthlyBudget) || monthlyBudget < 0)) {
    return { error: "Enter a valid monthly budget." }
  }

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) return { error: "Authentication required." }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) return { error: "Workspace membership could not be loaded." }
  if (membership.role !== "owner" && membership.role !== "admin") return { error: "Only workspace owners or admins can complete client intake." }

  const { error } = await supabase.from("client_intake_profiles").upsert({
    organization_id: membership.organization_id,
    contact_name: contactName,
    company_name: companyName,
    website_url: websiteUrl,
    industry,
    company_size: companySize,
    country,
    timezone,
    business_description: businessDescription,
    primary_goal: primaryGoal,
    biggest_problem: biggestProblem,
    current_tools: list(formData, "currentTools"),
    requested_services: list(formData, "requestedServices"),
    monthly_budget: monthlyBudget,
    budget_currency: budgetCurrency,
    timeline,
    lead_volume: leadVolume,
    sales_channels: list(formData, "salesChannels"),
    automation_readiness: automationReadiness,
    notes,
    intake_completed_at: new Date().toISOString(),
  }, { onConflict: "organization_id" })

  if (error) return { error: "Unable to save your client profile. Please try again." }

  redirect("/dashboard")
}
