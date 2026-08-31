"use client"

import { Breadcrumbs } from "./breadcrumbs"
import { signOut } from "@/app/dashboard/actions"

type TopbarProps = {
  organizationName: string | null
  userLabel: string | null
  initials: string
  onToggleMobileNav: () => void
}

export function Topbar({
  organizationName,
  userLabel,
  initials,
  onToggleMobileNav,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05070b]/85 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-label="Open navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
          >
            <span className="flex flex-col gap-1" aria-hidden="true">
              <span className="h-px w-4 bg-current" />
              <span className="h-px w-4 bg-current" />
              <span className="h-px w-4 bg-current" />
            </span>
          </button>
          <div className="hidden min-w-0 sm:block">
            <Breadcrumbs />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.02] px-3 py-1.5 md:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300/15 text-xs font-semibold text-cyan-200">
              {initials}
            </span>
            <div className="min-w-0 leading-tight">
              {organizationName ? (
                <p className="flex items-center gap-1.5 text-xs text-white/70">
                  {organizationName}
                  <span
                    aria-hidden="true"
                    className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan-300"
                  />
                </p>
              ) : null}
              <p className="max-w-[10rem] truncate text-[11px] text-white/35">
                {userLabel ?? "Workspace"}
              </p>
            </div>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 px-3 text-sm text-white/60 transition-colors hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-200"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      <div className="border-t border-white/5 px-4 py-2 sm:hidden">
        <Breadcrumbs />
      </div>
    </header>
  )
}
