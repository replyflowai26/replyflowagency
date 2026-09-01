import Link from "next/link"

type ErrorPanelProps = {
  title?: string
  message?: string
  onReset?: () => void
  backHref?: string
  backLabel?: string
}

// Presentational production-safe error panel used by route error boundaries.
// Rendered inside the existing dark dashboard shell. No client-only logic here;
// the reset handler is provided by the owning error boundary.
export function ErrorPanel({
  title = "Something went wrong",
  message = "We could not load this view. Please try again, or return to the dashboard.",
  onReset,
  backHref = "/dashboard",
  backLabel = "Back to dashboard",
}: ErrorPanelProps) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="rounded-2xl border border-white/10 bg-[#090c12]/80 p-8 text-center shadow-xl backdrop-blur-xl">
        <span className="relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-red-300/25 bg-red-300/[.06]">
          <span className="h-2 w-2 rounded-full bg-red-300" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-white">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg border border-cyan-300/25 bg-cyan-300/[.08] px-4 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-300/15"
            >
              Try again
            </button>
          ) : null}
          <Link
            href={backHref}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
