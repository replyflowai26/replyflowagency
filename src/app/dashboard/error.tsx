"use client"

import { ErrorPanel } from "@/components/dashboard/error-panel"

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorPanel
      onReset={reset}
      message="We could not load this dashboard view. Please try again. Your data remains safe."
    />
  )
}
