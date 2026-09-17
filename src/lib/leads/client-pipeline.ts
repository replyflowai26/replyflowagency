// Pure client sales-pipeline payload validation and normalization.
//
// Dependency-free (no supabase/next imports) so it can be unit tested
// directly by the bridge test build and reused by the server actions.

import { CLIENT_STATUSES, OUTREACH_STATUSES } from "../../types/client"
import type { ClientStatus, OutreachStatus } from "../../types/client"

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ClientPipelineInput = {
  name: string
  contactName?: string | null
  email?: string | null
  status?: string
  outreachStatus?: string
  nextFollowUpAt?: string
}

export type ClientPipelineError = {
  error: string
}

export function isClientStatus(value: string): value is ClientStatus {
  return (CLIENT_STATUSES as readonly string[]).includes(value)
}

export function isOutreachStatus(value: string): value is OutreachStatus {
  return (OUTREACH_STATUSES as readonly string[]).includes(value)
}

export function parseClientPipelineInput(
  input: ClientPipelineInput,
): { value: { status: ClientStatus; outreach_status: OutreachStatus; next_follow_up_at: string | null } } | ClientPipelineError {
  const name = input.name.trim()
  if (name.length < 2) return { error: "Client/company name is required." }

  const email = (input.email ?? "").trim()
  if (email && !EMAIL.test(email)) return { error: "Enter a valid client email." }

  const status = input.status ?? "lead"
  if (!isClientStatus(status)) return { error: "Invalid client status." }

  const outreachStatus = input.outreachStatus ?? "not_started"
  if (!isOutreachStatus(outreachStatus)) return { error: "Invalid outreach status." }

  const rawFollowUp = (input.nextFollowUpAt ?? "").trim()
  let next_follow_up_at: string | null = null
  if (rawFollowUp) {
    const dateOnly = rawFollowUp.match(ISO_DATE_ONLY)
    if (dateOnly) {
      next_follow_up_at = `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T00:00:00.000Z`
    } else {
      const parsed = Date.parse(rawFollowUp)
      if (Number.isNaN(parsed)) return { error: "Enter a valid next follow-up date." }
      next_follow_up_at = new Date(parsed).toISOString()
    }
  }

  return { value: { status, outreach_status: outreachStatus, next_follow_up_at } }
}