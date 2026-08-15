"use client"

import { ClientIntakeForm } from "@/components/client-intake-form"
import { AuthShell } from "@/components/auth-shell"

export default function OnboardingPage() {
  return (
    <AuthShell
      eyebrow="Client discovery"
      title="Tell us how your business works."
      description="The more context you share now, the better we can design the right automation system for your goals, workflow and budget."
    >
      <ClientIntakeForm />
    </AuthShell>
  )
}
