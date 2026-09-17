export const CLIENT_STATUSES = ["lead", "prospect", "active", "paused", "completed", "archived"] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const OUTREACH_STATUSES = ["not_started", "contacted", "following_up", "meeting_scheduled", "closed_won", "closed_lost"] as const
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number]

export type Client = {
  id: string
  organization_id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website_url: string | null
  industry: string | null
  status: ClientStatus
  source: string | null
  notes: string | null
  outreach_status: OutreachStatus
  next_follow_up_at: string | null
  owner_user_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export const CLIENT_ACTIVITY_TYPES = [
  "client.created",
  "client.status_changed",
  "client.outreach_updated",
  "client.updated",
  "workflow_run.associated",
] as const
export type ClientActivityType = (typeof CLIENT_ACTIVITY_TYPES)[number]

export type ClientActivity = {
  id: string
  organization_id: string
  client_id: string
  activity_type: ClientActivityType
  title: string
  description: string | null
  actor_user_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}
