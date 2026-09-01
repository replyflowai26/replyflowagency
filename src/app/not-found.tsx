import Link from "next/link"

export default function NotFound() {
  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(124,58,237,.14),transparent_30rem),radial-gradient(circle_at_90%_60%,rgba(34,211,238,.08),transparent_28rem)]" />
      <div className="relative flex min-h-dvh items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#090c12]/80 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
          <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10">
            <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-cyan-300" />
          </span>
          <p className="mt-6 text-xs font-medium uppercase tracking-[.2em] text-cyan-300">
            404
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.02em] text-white">
            Page not found
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/45">
            The page you are looking for does not exist, or it may have been
            moved. Check the URL and try again.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-cyan-300/25 bg-cyan-300/[.08] px-4 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-300/15"
            >
              Go to dashboard
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              Back home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
