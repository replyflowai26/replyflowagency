import "server-only"

import { createClient } from "@/lib/supabase/server"

const DEFAULT_WINDOW_DAYS = 30

export type RecentRunStats = {
  succeeded: number
  failed: number
  finalized: number
  successRate: number | null
}

export type RecentActivityItem = {
  id: string
  activityType: string
  title: string
  description: string | null
  createdAt: string
}

export type DashboardTelemetry = {
  organizationId: string
  windowDays: number
  totalClients: number
  activeWorkflows: number
  runStats: RecentRunStats
  recentActivities: RecentActivityItem[]
}

/**
 * Build organization-scoped dashboard telemetry from real production data.
 *
 * All queries are bounded, run in parallel, and are scoped to the resolved
 * organization id that the caller already derived from the authenticated
 * user's membership. Authorization relies on the same RLS boundaries as every
 * other dashboard read path: the organization passed in must contain the
 * authenticated user, otherwise the RLS-scoped client returns no rows.
 */
export async function getDashboardTelemetry(
  organizationId: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<DashboardTelemetry> {
  const supabase = await createClient()
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const [clientsResult, workflowsResult, succeededResult, failedResult, activityResult] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      supabase
        .from("workflows")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active"),
      supabase
        .from("workflow_runs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "succeeded")
        .gte("created_at", since.toISOString()),
      supabase
        .from("workflow_runs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "failed")
        .gte("created_at", since.toISOString()),
      supabase
        .from("client_activities")
        .select("id, activity_type, title, description, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(8),
    ])

  for (const result of [clientsResult, workflowsResult, succeededResult, failedResult]) {
    if (result.error) {
      throw new Error(`Unable to load dashboard telemetry: ${result.error.message}`)
    }
  }
  if (activityResult.error) {
    throw new Error(`Unable to load recent activity: ${activityResult.error.message}`)
  }

  const succeeded = succeededResult.count ?? 0
  const failed = failedResult.count ?? 0
  const finalized = succeeded + failed

  let successRate: number | null = null
  if (finalized > 0) {
    successRate = succeeded / finalized
  }

  const recentActivities = (activityResult.data ?? []).map((activity) => ({
    id: activity.id,
    activityType: activity.activity_type,
    title: activity.title,
    description: activity.description,
    createdAt: activity.created_at,
  }))

  return {
    organizationId,
    windowDays,
    totalClients: clientsResult.count ?? 0,
    activeWorkflows: workflowsResult.count ?? 0,
    runStats: { succeeded, failed, finalized, successRate },
    recentActivities,
  }
}
