"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { ClientStatus, OutreachStatus } from "@/types/client"
import { logClientActivity } from "@/lib/client-activity"
import { parseClientPipelineInput } from "@/lib/leads/client-pipeline"

type ActionState = { error?: string; success?: string }

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim()
}

async function getMembership() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) return { supabase, userId: null, membership: null }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return { supabase, userId, membership }
}

export async function createClientRecord(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const name = clean(formData.get("name"))
  const contactName = clean(formData.get("contactName")) || null
  const email = clean(formData.get("email")) || null
  const phone = clean(formData.get("phone")) || null
  const websiteUrl = clean(formData.get("websiteUrl")) || null
  const industry = clean(formData.get("industry")) || null
  const source = clean(formData.get("source")) || null
  const notes = clean(formData.get("notes")) || null

  const pipeline = parseClientPipelineInput({
    name,
    email,
    nextFollowUpAt: clean(formData.get("nextFollowUpAt")),
  })
  if ("error" in pipeline) return pipeline

  const { supabase, userId, membership } = await getMembership()
  if (!userId) return { error: "Authentication required." }
  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "You do not have permission to create clients." }
  }

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      organization_id: membership.organization_id,
      name,
      contact_name: contactName,
      email,
      phone,
      website_url: websiteUrl,
      industry,
      source,
      notes,
      outreach_status: pipeline.value.outreach_status,
      next_follow_up_at: pipeline.value.next_follow_up_at,
      owner_user_id: userId,
      created_by: userId,
    })
    .select("id, name")
    .single()

  if (error) return { error: "Unable to create the client. Please try again." }

  await logClientActivity({
    organizationId: membership.organization_id,
    clientId: created.id,
    activityType: "client.created",
    title: `Created client ${created.name}`,
    description: source ? `Source: ${source}` : "New client record created.",
    actorUserId: userId,
    metadata: { source },
  })

  revalidatePath("/dashboard/clients")
  return { success: "Client created successfully." }
}

export async function updateClientRecord(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const id = clean(formData.get("id"))
  const name = clean(formData.get("name"))
  const contactName = clean(formData.get("contactName")) || null
  const email = clean(formData.get("email")) || null
  const phone = clean(formData.get("phone")) || null
  const websiteUrl = clean(formData.get("websiteUrl")) || null
  const industry = clean(formData.get("industry")) || null
  const source = clean(formData.get("source")) || null
  const notes = clean(formData.get("notes")) || null
  const status = clean(formData.get("status")) as ClientStatus

  const pipeline = parseClientPipelineInput({
    name,
    email,
    status,
    outreachStatus: clean(formData.get("outreachStatus")),
    nextFollowUpAt: clean(formData.get("nextFollowUpAt")),
  })
  if ("error" in pipeline) return pipeline

  if (!id) return { error: "Client id is required." }

  const { supabase, userId, membership } = await getMembership()
  if (!userId) return { error: "Authentication required." }
  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "You do not have permission to update clients." }
  }

  const { data: existing, error: existingError } = await supabase
    .from("clients")
    .select("id, name, contact_name, email, phone, website_url, industry, source, notes, status, outreach_status")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()

  if (existingError || !existing) {
    return { error: "Client not found in this workspace." }
  }

  const { error } = await supabase
    .from("clients")
    .update({
      name,
      contact_name: contactName,
      email,
      phone,
      website_url: websiteUrl,
      industry,
      source,
      notes,
      status,
      outreach_status: pipeline.value.outreach_status,
      next_follow_up_at: pipeline.value.next_follow_up_at,
    })
    .eq("id", id)
    .eq("organization_id", membership.organization_id)

  if (error) return { error: "Unable to update the client. Please try again." }

  if (existing.status !== status) {
    await logClientActivity({
      organizationId: membership.organization_id,
      clientId: id,
      activityType: "client.status_changed",
      title: `Status changed from ${existing.status} to ${status}`,
      actorUserId: userId,
      metadata: { from: existing.status, to: status },
    })
  }
  if (existing.outreach_status !== pipeline.value.outreach_status) {
    await logClientActivity({
      organizationId: membership.organization_id,
      clientId: id,
      activityType: "client.outreach_updated",
      title: `Outreach status changed from ${existing.outreach_status} to ${pipeline.value.outreach_status}`,
      actorUserId: userId,
      metadata: { from: existing.outreach_status, to: pipeline.value.outreach_status },
    })
  } else if (
    name !== existing.name ||
    contactName !== existing.contact_name ||
    email !== existing.email ||
    phone !== existing.phone ||
    websiteUrl !== existing.website_url ||
    industry !== existing.industry ||
    source !== existing.source ||
    notes !== existing.notes
  ) {
    await logClientActivity({
      organizationId: membership.organization_id,
      clientId: id,
      activityType: "client.updated",
      title: `Updated ${existing.name}`,
      actorUserId: userId,
      metadata: { fields: ["details"] },
    })
  }

  revalidatePath("/dashboard/clients")
  revalidatePath(`/dashboard/clients/${id}`)
  return { success: "Client updated successfully." }
}

export async function deleteClientRecord(formData: FormData): Promise<ActionState> {
  const id = clean(formData.get("id"))
  if (!id) return { error: "Client id is required." }

  const { supabase, userId, membership } = await getMembership()
  if (!userId) return { error: "Authentication required." }
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Only workspace owners and admins can delete clients." }
  }

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("organization_id", membership.organization_id)

  if (error) return { error: "Unable to delete the client. Please try again." }

  revalidatePath("/dashboard/clients")
  return { success: "Client deleted successfully." }
}
