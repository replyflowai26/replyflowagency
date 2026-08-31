export type DashboardNavItem = {
  label: string
  href: string
  enabled: boolean
  match: (pathname: string) => boolean
}

export type DashboardNavGroup = {
  label: string
  items: DashboardNavItem[]
}

const startsWithSegment = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

export const dashboardNavigation: DashboardNavGroup[] = [
  {
    label: "Core",
    items: [
      {
        label: "Overview",
        href: "/dashboard",
        enabled: true,
        match: (pathname) => pathname === "/dashboard",
      },
      {
        label: "Clients",
        href: "/dashboard/clients",
        enabled: true,
        match: (pathname) => startsWithSegment(pathname, "/dashboard/clients"),
      },
      {
        label: "Projects",
        href: "/dashboard/projects",
        enabled: true,
        match: (pathname) => startsWithSegment(pathname, "/dashboard/projects"),
      },
      {
        label: "Automations",
        href: "/dashboard/automations",
        enabled: false,
        match: () => false,
      },
      {
        label: "Runs",
        href: "/dashboard/runs",
        enabled: false,
        match: () => false,
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        label: "Leads / CRM",
        href: "/dashboard/leads",
        enabled: false,
        match: () => false,
      },
      {
        label: "Reports",
        href: "/dashboard/reports",
        enabled: false,
        match: () => false,
      },
      {
        label: "Notifications",
        href: "/dashboard/notifications",
        enabled: false,
        match: () => false,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Settings",
        href: "/dashboard/settings",
        enabled: false,
        match: () => false,
      },
      {
        label: "Help & Support",
        href: "/dashboard/help",
        enabled: false,
        match: () => false,
      },
    ],
  },
  {
    label: "AI",
    items: [
      {
        label: "Jarvis",
        href: "/dashboard/jarvis",
        enabled: false,
        match: () => false,
      },
    ],
  },
]

export function isDashboardPathActive(
  pathname: string,
  item: DashboardNavItem,
): boolean {
  return item.enabled && item.match(pathname)
}

export type DashboardCrumb = {
  label: string
  href?: string
}

export function dashboardTrail(pathname: string): DashboardCrumb[] {
  const trail: DashboardCrumb[] = [{ label: "Dashboard", href: "/dashboard" }]

  if (pathname === "/dashboard") return trail

  if (startsWithSegment(pathname, "/dashboard/clients")) {
    trail.push({ label: "Clients", href: "/dashboard/clients" })
    if (pathname !== "/dashboard/clients") {
      trail.push({ label: "Client" })
    }
    return trail
  }

  if (startsWithSegment(pathname, "/dashboard/projects")) {
    trail.push({ label: "Projects", href: "/dashboard/projects" })
    const rest = pathname.slice("/dashboard/projects".length)
    if (rest.startsWith("/")) {
      const segments = rest.split("/").filter(Boolean)
      if (segments.length >= 1) {
        const projectId = segments[0]
        const projectHref = `/dashboard/projects/${projectId}`
        trail.push({
          label: "Project",
          href: segments.length > 1 ? projectHref : undefined,
        })
        if (segments[1] === "runs") {
          trail.push({ label: "Runs" })
        }
      }
    }
    return trail
  }

  return trail
}
