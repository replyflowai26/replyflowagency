import "server-only"

import { createClient } from "@supabase/supabase-js"
import { getSupabaseEnvironment } from "./env"

export function createAdminClient() {
  const { url } = getSupabaseEnvironment()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for trusted server operations.")
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
