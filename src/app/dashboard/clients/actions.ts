"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { CLIENT_STATUSES, type ClientStatus } from "@/types/client"

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

  if (name.length < 2) return { error: "Client/company name is required." }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid client email." }

  const { supabase, userId, membership } = await getMembership()
  if (!userId) return { error: "Authentication required." }
  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "You do not have permission to create clients." }
  }

  const { error } = await supabase.from("clients").insert({
    organization_id: membership.organization_id,
    name,
    contact_name: contactName,
    email,
    phone,
    website_url: websiteUrl,
    industry,
    source,
    notes,
    owner_user_id: userId,
    created_by: userId,
  })

  if (error) return { error: "Unable to create the client. Please try again." }

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

  if (!id) return { error: "Client id is required." }
  if (name.length < 2) return { error: "Client/company name is required." }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid client email." }
  if (!CLIENT_STATUSES.includes(status)) return { error: "Invalid client status." }

  const { supabase, userId, membership } = await getMembership()
  if (!userId) return { error: "Authentication required." }
  if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
    return { error: "You do not have permission to update clients." }
  }

  const { error } = await supabase
    .from("clients")
    .update({ name, contact_name: contactName, email, phone, website_url: websiteUrl, industry, source, notes, status })
    .eq("id", id)
    .eq("organization_id", membership.organization_id)

  if (error) return { error: "Unable to update the client. Please try again." }

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
