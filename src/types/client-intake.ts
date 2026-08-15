export const CLIENT_COMPANY_SIZES = ["solo", "2-10", "11-50", "51-200", "201-500", "500+"] as const
export type ClientCompanySize = (typeof CLIENT_COMPANY_SIZES)[number]

export const CLIENT_TIMELINES = ["asap", "2-4-weeks", "1-3-months", "3-months+", "exploring"] as const
export type ClientTimeline = (typeof CLIENT_TIMELINES)[number]

export const AUTOMATION_READINESS = ["new", "some-automation", "advanced"] as const
export type AutomationReadiness = (typeof AUTOMATION_READINESS)[number]

export type ClientIntakeProfile = {
  organization_id: string
  contact_name: string
  company_name: string
  website_url: string | null
  industry: string | null
  company_size: ClientCompanySize | null
  country: string | null
  timezone: string | null
  business_description: string | null
  primary_goal: string | null
  biggest_problem: string | null
  current_tools: string[]
  requested_services: string[]
  monthly_budget: number | null
  budget_currency: string
  timeline: ClientTimeline | null
  lead_volume: string | null
  sales_channels: string[]
  automation_readiness: AutomationReadiness | null
  notes: string | null
  intake_completed_at: string
  created_at: string
  updated_at: string
}
