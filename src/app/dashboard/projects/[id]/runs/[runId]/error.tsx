"use client"

import { ErrorPanel } from "@/components/dashboard/error-panel"

export default function RunDetailError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorPanel
      onReset={reset}
      message="We could not load this run. Please try again. Your data remains safe."
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  )
}