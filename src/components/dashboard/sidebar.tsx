"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useId } from "react"
import {
  dashboardNavigation,
  isDashboardPathActive,
} from "@/lib/dashboard/navigation"
import { cn } from "@/lib/utils"

type SidebarProps = {
  organizationName: string | null
  onNavigate?: () => void
}

function BrandMark({ organizationName }: { organizationName: string | null }) {
  return (
    <a
      href="/dashboard"
      className="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
      aria-label="ReplyFlow AI dashboard"
    >
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10">
        <span className="pulse-dot h-2 w-2 rounded-full bg-cyan-300" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight text-white">
          ReplyFlow AI
        </p>
        {organizationName ? (
          <p className="max-w-[9.5rem] truncate text-[10px] uppercase tracking-[.16em] text-white/30">
            {organizationName}
          </p>
        ) : (
          <p className="text-[10px] uppercase tracking-[.16em] text-white/30">
            Company OS
          </p>
        )}
      </div>
    </a>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const groupId = useId()

  return (
    <nav aria-label="Dashboard navigation" className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 px-3 py-4">
        {dashboardNavigation.map((group, groupIndex) => (
          <div key={`${groupId}-${groupIndex}`}>
            <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[.18em] text-white/25">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isDashboardPathActive(pathname, item)
                if (!item.enabled) {
                  return (
                    <li key={item.label}>
                      <span
                        aria-disabled="true"
                        className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/30"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-white/15"
                          aria-hidden="true"
                        />
                        <span className="flex-1">{item.label}</span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/25">
                          Soon
                        </span>
                      </span>
                    </li>
                  )
                }
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-cyan-300/10 text-cyan-100"
                          : "text-white/55 hover:bg-white/[.04] hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          active ? "bg-cyan-300" : "bg-white/25",
                        )}
                        aria-hidden="true"
                      />
                      <span className="flex-1 font-medium">{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

export function Sidebar({
  organizationName,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-white/10 bg-[#080b11]">
      <div className="border-b border-white/10 px-3 py-4">
        <BrandMark organizationName={organizationName} />
      </div>
      <NavList onNavigate={onNavigate} />
      <div className="border-t border-white/10 px-3 py-3">
        <p className="px-2 text-[10px] uppercase tracking-[.18em] text-white/25">
          ReplyFlow OS
        </p>
      </div>
    </aside>
  )
}
