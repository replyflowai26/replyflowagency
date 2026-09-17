"use client"

import { ErrorPanel } from "@/components/dashboard/error-panel"

export default function ProjectDetailError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorPanel
      onReset={reset}
      message="We could not load this project. Please try again, or return to your projects list. Your data remains safe."
      backHref="/dashboard/projects"
      backLabel="Back to projects"
    />
  )
}