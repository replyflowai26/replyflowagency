"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/security/rate-limit"

type ContactState = { error?: string; success?: boolean }

const CONTACT_RATE_LIMIT = 5
const CONTACT_RATE_WINDOW_MS = 10 * 60_000

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim()
}

function clientIp(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return requestHeaders.get("x-real-ip") ?? "unknown"
}

export async function submitContactLead(
  _previousState: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const limit = rateLimit(`contact:${clientIp(await headers())}`, {
    limit: CONTACT_RATE_LIMIT,
    windowMs: CONTACT_RATE_WINDOW_MS,
  })
  if (!limit.allowed) {
    return { error: "Too many requests. Please try again in a few minutes." }
  }

  const name = clean(formData.get("name"))
  const email = clean(formData.get("email")).toLowerCase()
  const company = clean(formData.get("company"))
  const message = clean(formData.get("message"))

  if (name.length < 2 || name.length > 120) return { error: "Enter your name." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." }
  if (company && (company.length < 2 || company.length > 160)) return { error: "Enter a valid company name." }
  if (message.length < 10 || message.length > 3000) return { error: "Tell us a little more about the work you want to automate." }

  const supabase = await createClient()
  const { error } = await supabase.from("contact_leads").insert({
    name,
    email,
    company: company || null,
    message,
    source: "website",
  })

  if (error) {
    return { error: "We could not send your request. Please try again." }
  }

  return { success: true }
}
