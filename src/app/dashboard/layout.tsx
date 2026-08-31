import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

function deriveInitials(label: string): string {
  const words = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

type MembershipRow = {
  organization_id: string
  role: "owner" | "admin" | "member" | "viewer"
  organizations: { name: string } | { name: string }[] | null
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (claimsError || !userId) redirect("/login")

  const { data: membershipRaw, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membershipRaw) redirect("/onboarding")
  const membership = membershipRaw as unknown as MembershipRow

  const org = membership.organizations
  const organizationName = (Array.isArray(org) ? org[0]?.name : org?.name) ?? null

  const { data: userData } = await supabase.auth.getUser()
  const email = userData?.user?.email ?? null
  const displayName =
    (userData?.user?.user_metadata?.display_name as string | undefined) ?? null
  const userLabel = displayName ?? email
  const initials = deriveInitials(userLabel ?? "")

  return (
    <DashboardShell
      organizationName={organizationName}
      userLabel={userLabel}
      initials={initials}
    >
      {children}
    </DashboardShell>
  )
}
