"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const allowedRoles = new Set(["member", "viewer"] as const)
type InviteRole = "member" | "viewer"

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000"
  return value.startsWith("http") ? value.replace(/\/$/, "") : `https://${value}`
}

export async function inviteOrganizationMember(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const roleValue = String(formData.get("role") ?? "member")
  const role: InviteRole = allowedRoles.has(roleValue as InviteRole)
    ? (roleValue as InviteRole)
    : "member"
  const organizationId = String(formData.get("organizationId") ?? "")

  if (!organizationId || !isValidEmail(email)) {
    return { error: "Enter a valid email address." }
  }

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const actorId = claimsData?.claims?.sub

  if (claimsError || !actorId) {
    return { error: "Authentication required." }
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", actorId)
    .maybeSingle()

  if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "You do not have permission to invite members." }
  }

  const admin = createAdminClient()
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
  })

  if (inviteError || !inviteData.user) {
    return { error: "Unable to send the invitation." }
  }

  const { error: insertError } = await admin
    .from("organization_memberships")
    .insert({
      organization_id: organizationId,
      user_id: inviteData.user.id,
      role,
    })

  if (insertError) {
    await admin.auth.admin.deleteUser(inviteData.user.id)
    return { error: "Invitation could not be attached to the organization." }
  }

  const { error: auditError } = await supabase.from("audit_events").insert({
    organization_id: organizationId,
    actor_user_id: actorId,
    actor_type: "user",
    action: "membership.invited",
    entity_type: "organization_membership",
    entity_id: inviteData.user.id,
    metadata: { invited_email: email, role },
  })

  if (auditError) {
    return { error: "Invitation sent, but the audit record could not be created." }
  }

  return { success: true }
}
