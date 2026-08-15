"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type ActionState = { error?: string; success?: string }

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim()
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
  if (!["owner", "admin", "member"].includes(membership.role)) return { error: "You do not have permission to create clients." }

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
