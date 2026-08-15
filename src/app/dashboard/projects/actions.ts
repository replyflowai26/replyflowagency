"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160)

async function getMembership() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) throw new Error("Authentication required.")

  const { data: membership, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !membership) throw new Error("Workspace membership not found.")
  return { supabase, userId, membership }
}

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()

  if (name.length < 2 || name.length > 160) {
    throw new Error("Project name must be between 2 and 160 characters.")
  }

  const slug = slugify(name)
  if (!slug) throw new Error("Project name must contain letters or numbers.")

  const { supabase, userId, membership } = await getMembership()
  if (!["owner", "admin", "member"].includes(membership.role)) {
    throw new Error("You do not have permission to create projects.")
  }

  const { error } = await supabase.from("automation_projects").insert({
    organization_id: membership.organization_id,
    name,
    slug,
    description: description || null,
    created_by: userId,
  })

  if (error) {
    if (error.code === "23505") throw new Error("A project with this name already exists.")
    throw new Error("Unable to create project.")
  }

  revalidatePath("/dashboard/projects")
}

export async function createWorkflow(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim()
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()

  if (!projectId) throw new Error("Project is required.")
  if (name.length < 2 || name.length > 160) {
    throw new Error("Workflow name must be between 2 and 160 characters.")
  }

  const { supabase, userId, membership } = await getMembership()
  if (!["owner", "admin", "member"].includes(membership.role)) {
    throw new Error("You do not have permission to create workflows.")
  }

  const { data: project, error: projectError } = await supabase
    .from("automation_projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle()

  if (projectError || !project) throw new Error("Project not found in this workspace.")

  const { error } = await supabase.from("workflows").insert({
    organization_id: membership.organization_id,
    project_id: project.id,
    name,
    description: description || null,
    created_by: userId,
  })

  if (error) throw new Error("Unable to create workflow.")

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath("/dashboard/projects")
}
