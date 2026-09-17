"use client"

import { ErrorPanel } from "@/components/dashboard/error-panel"

export default function ClientDetailError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorPanel
      onReset={reset}
      message="We could not load this client. Please try again, or return to your clients list. Your data remains safe."
      backHref="/dashboard/clients"
      backLabel="Back to clients"
    />
  )
}
