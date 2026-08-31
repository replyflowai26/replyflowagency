"use client"

import { useState } from "react"
import { Topbar } from "./topbar"
import { Sidebar } from "./sidebar"
import { MobileNav } from "./mobile-nav"

export type DashboardUser = {
  organizationName: string | null
  userLabel: string | null
  initials: string
}

type DashboardShellProps = DashboardUser & {
  children: React.ReactNode
}

export function DashboardShell({
  organizationName,
  userLabel,
  initials,
  children,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-[#05070b] text-white">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">
        <Sidebar organizationName={organizationName} />
      </div>

      <div className="lg:pl-64">
        <Topbar
          organizationName={organizationName}
          userLabel={userLabel}
          initials={initials}
          onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
        />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      <MobileNav
        open={mobileNavOpen}
        organizationName={organizationName}
        onClose={() => setMobileNavOpen(false)}
      />
    </div>
  )
}
