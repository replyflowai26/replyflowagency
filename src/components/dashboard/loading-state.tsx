// Server-safe shared loading skeleton for dashboard segments and routes.
// Matches the existing dark SaaS design language without adding dependencies.

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-white/[.06] ${className ?? ""}`}
    />
  )
}

// Wraps any skeleton composition with an accessible status region used by
// route loading.tsx files.
export function LoadingScreen({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
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

// --- Shared route skeleton building blocks ---------------------------------

// Page header with optional eyebrow, a title line, and a subtitle line.
export function PageHeaderSkeleton({ eyebrow = false }: { eyebrow?: boolean }) {
  return (
    <div className="mb-8">
      {eyebrow ? <SkeletonBlock className="h-3 w-28" /> : null}
      <SkeletonBlock className="mt-3 h-8 w-64 max-w-full" />
      <SkeletonBlock className="mt-2 h-3 w-52" />
    </div>
  )
}

// A bordered card with list rows, matching the list registry pages
// (clients, projects, runs).
export function RegistryRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
      <div className="border-b border-white/8 px-5 py-4">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="mt-1.5 h-3 w-28" />
      </div>
      <div className="divide-y divide-white/8">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-5"
          >
            <div>
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="mt-2 h-3 w-64 max-w-full" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-5 w-16 rounded-full" />
              <SkeletonBlock className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// A single rounded content card used to scaffold detail page sections.
export function SectionCardSkeleton({
  withHeader = false,
  bodyLines = 3,
}: {
  withHeader?: boolean
  bodyLines?: number
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
      {withHeader ? (
        <div className="border-b border-white/8 px-5 py-4">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="mt-1.5 h-3 w-32" />
        </div>
      ) : null}
      <div className="p-5">
        {Array.from({ length: bodyLines }).map((_, i) => (
          <SkeletonBlock
            key={i}
            className={
              i === 0
                ? "h-4 w-3/4"
                : i === 1
                  ? "mt-2 h-3 w-1/2"
                  : i === 2
                    ? "mt-4 h-3 w-full"
                    : "mt-1.5 h-3 w-2/3"
            }
          />
        ))}
      </div>
    </div>
  )
}

// A compact stat card used in KPI / status grids.
export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-5">
      <SkeletonBlock className="h-3 w-16" />
      <SkeletonBlock className="mt-3 h-6 w-20" />
      <SkeletonBlock className="mt-2 h-3 w-28" />
    </div>
  )
}
