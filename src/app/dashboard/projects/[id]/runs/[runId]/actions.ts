"use server"

import { createClient } from "@/lib/supabase/server"
import { getRunSnapshot } from "@/lib/dashboard/run-observability"
import { retryWorkflowRun as runRetry } from "@/app/dashboard/projects/[id]/run-actions"

async function resolveOrganizationId(): Promise<string> {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) {
    throw new Error("Authentication required.")
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) {
    throw new Error("Workspace membership not found.")
  }

  return membership.organization_id
}

export async function getRunSnapshotAction(input: { runId: string }) {
  if (!input?.runId) {
    return { detail: null, events: [] }
  }

  const organizationId = await resolveOrganizationId()
  return getRunSnapshot(organizationId, input.runId, 50)
}

export async function retryRunFromDetail(formData: FormData) {
  return runRetry(formData)
}
