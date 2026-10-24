"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { resolveLeadApproval } from "@/lib/automation/lead-capture-service"
import { logError } from "@/lib/telemetry/logging"
import {
  authorizeLeadApproval,
  leadApprovalResponseForOutcome,
  LEAD_APPROVAL_ERROR_CODES,
  parseLeadApprovalRequest,
  type LeadApprovalActionResponse,
  type LeadApprovalActor,
  type LeadApprovalRunFacts,
} from "@/lib/automation/lead-approval-core"

// Authenticated human-approval surface for the lead-capture workflow.
//
// A hot lead is queued with approval_state = 'pending' and is NOT contacted
// until an owner/admin resolves the gate. This action is the ONLY supported way
// for a person to resolve that gate.
//
// Security model:
//   - The caller is identified from the session (supabase.auth.getClaims), never
//     from the request. No user id, organization id, role, status or approval
//     state is ever read from the client.
//   - The actor must hold an APPROVER role (owner/admin) in their organization
//     (LEAD_APPROVAL_APPROVER_ROLES). A plain member is refused.
//   - The run is read through the USER (RLS) client, organization-scoped, and is
//     additionally re-checked against the project named in the request, so a
//     cross-tenant or cross-project reference is refused as "not found".
//   - Only a still-queued, still-pending run is accepted; stale or duplicate
//     decisions are refused. The atomic authority lives in decideLeadApproval,
//     whose compare-and-set guarantees a decision is applied exactly once.
//   - The approval is resolved through the existing server-side service, which
//     holds the credentials. No service-role key or secret ever reaches the
//     browser.
//   - Failures return a typed, non-revealing response. Raw provider or database
//     errors are logged server-side and never surfaced to the caller.

type ActorContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  actor: LeadApprovalActor
  organizationId: string | null
}

async function loadActor(): Promise<ActorContext> {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub ?? null

  if (claimsError || !userId) {
    return {
      supabase,
      actor: {
        userId: null,
        membershipOrganizationId: null,
        membershipRole: null,
      },
      organizationId: null,
    }
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    supabase,
    actor: {
      userId,
      membershipOrganizationId: membership?.organization_id ?? null,
      membershipRole: membership?.role ?? null,
    },
    organizationId: membership?.organization_id ?? null,
  }
}

/**
 * Resolve a pending hot-lead approval. `formData` carries only `projectId`,
 * `runId` and `decision` ("approved" | "rejected"); everything security-relevant
 * is derived server-side. Returns a typed, serializable result and never throws
 * for a normal authorization or business outcome.
 */
export async function resolveLeadApprovalAction(
  formData: FormData,
): Promise<LeadApprovalActionResponse> {
  const parsed = parseLeadApprovalRequest({
    projectId: formData.get("projectId"),
    runId: formData.get("runId"),
    decision: formData.get("decision"),
  })

  if (!parsed.ok) {
    return {
      ok: false,
      code: LEAD_APPROVAL_ERROR_CODES.invalid,
      status: 400,
      error: parsed.error,
    }
  }

  const { supabase, actor, organizationId } = await loadActor()

  // Read the run through the user's RLS client, organization-scoped. A
  // cross-tenant id is not returned here at all; the pure gate below still
  // re-checks the organization and the project as defense in depth.
  let run: LeadApprovalRunFacts | null = null
  if (actor.userId && organizationId) {
    const { data } = await supabase
      .from("workflow_runs")
      .select("organization_id, project_id, workflow_id, client_id, status, approval_state")
      .eq("id", parsed.runId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (data) {
      run = {
        organizationId: data.organization_id,
        projectId: data.project_id,
        workflowId: data.workflow_id,
        clientId: data.client_id ?? null,
        status: data.status,
        approvalState: data.approval_state,
      }
    }
  }

  const authorized = authorizeLeadApproval({
    actor,
    expectedProjectId: parsed.projectId,
    run,
  })

  if (!authorized.ok) {
    return {
      ok: false,
      code: authorized.code,
      status: authorized.status,
      error: authorized.error,
    }
  }

  try {
    const outcome = await resolveLeadApproval(parsed.runId, parsed.decision, {
      organizationId: authorized.run.organizationId,
      projectId: authorized.run.projectId,
      workflowId: authorized.run.workflowId,
      clientId: authorized.run.clientId,
      // The authenticated approver (session-derived, never client-supplied) is
      // recorded in the decision's audit event so every approval is attributable.
      decidedByUserId: actor.userId,
    })

    revalidatePath(`/dashboard/projects/${parsed.projectId}`)

    return leadApprovalResponseForOutcome(outcome)
  } catch (error) {
    logError(
      "approvals.lead",
      "Lead approval action failed",
      error instanceof Error ? error : undefined,
      {
        organization_id: authorized.run.organizationId,
        run_id: parsed.runId,
      },
    )
    return {
      ok: false,
      code: LEAD_APPROVAL_ERROR_CODES.failed,
      status: 500,
      error: "Unable to resolve the approval.",
    }
  }
}
