"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

type OrganizationFormState = { error?: string }

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

export async function createOrganization(
  _previousState: OrganizationFormState,
  formData: FormData,
): Promise<OrganizationFormState> {
  const name = String(formData.get("name") ?? "").trim()
  const requestedSlug = String(formData.get("slug") ?? "").trim()
  const slug = slugify(requestedSlug || name)

  if (name.length < 2 || name.length > 120 || !slug) {
    return { error: "Enter a valid organization name and slug." }
  }

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()

  if (claimsError || !claimsData?.claims?.sub) {
    return { error: "Authentication required." }
  }

  const { error } = await supabase.rpc("create_organization", {
    organization_name: name,
    organization_slug: slug,
  })

  if (error) {
    if (error.code === "23505") {
      return { error: "That organization slug is already in use." }
    }

    return { error: "Unable to create the organization." }
  }

  redirect("/dashboard")
}
