// Server-safe shared loading skeleton for dashboard segments and routes.
// Matches the existing dark SaaS design language without adding dependencies.

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-white/[.06] ${className ?? ""}`}
    />
  )
}

export function DashboardCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <SkeletonBlock className="h-2.5 w-20" />
      <SkeletonBlock className="mt-4 h-6 w-24" />
      <SkeletonBlock className="mt-1.5 h-3 w-32" />
    </div>
  )
}

export function DashboardLoadingState({ title }: { title?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading dashboard">
      <span className="sr-only">Loading…</span>
      <div className="mb-8">
        {title ? (
          <SkeletonBlock className="h-2.5 w-40" />
        ) : (
          <SkeletonBlock className="h-2.5 w-40" />
        )}
        <SkeletonBlock className="mt-3 h-8 w-72 max-w-full" />
        <SkeletonBlock className="mt-2 h-3 w-52" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
      </div>
      <div className="mt-5">
        <SkeletonBlock className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  )
}
