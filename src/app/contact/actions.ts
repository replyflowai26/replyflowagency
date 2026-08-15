"use server"

import { createClient } from "@/lib/supabase/server"

type ContactState = { error?: string; success?: boolean }

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim()
}

export async function submitContactLead(
  _previousState: ContactState,
  formData: FormData,
): Promise<ContactState> {
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
