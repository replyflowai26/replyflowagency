"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { dashboardTrail } from "@/lib/dashboard/navigation"
import { cn } from "@/lib/utils"

export function Breadcrumbs() {
  const pathname = usePathname()
  const trail = dashboardTrail(pathname)

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className="text-white/20"
                >
                  /
                </span>
              ) : null}
              {isLast || !crumb.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "truncate",
                    isLast ? "font-medium text-white" : "text-white/45",
                  )}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-white/45 transition-colors hover:text-white"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
