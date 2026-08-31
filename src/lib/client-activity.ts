import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { ClientActivityType } from "@/types/client"

type LogActivityOptions = {
  organizationId: string
  clientId: string
  activityType: ClientActivityType
  title: string
  description?: string
  actorUserId?: string | null
  metadata?: Record<string, unknown>
}

export async function logClientActivity(options: LogActivityOptions): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase.from("client_activities").insert({
    organization_id: options.organizationId,
    client_id: options.clientId,
    activity_type: options.activityType,
    title: options.title,
    description: options.description ?? null,
    actor_user_id: options.actorUserId ?? null,
    metadata: options.metadata ?? {},
  })

  if (error) {
    console.error("Failed to log client activity:", error.message)
  }
}
