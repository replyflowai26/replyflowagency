import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getJarvisRuntimeSummary } from "@/lib/agents/jarvis-status"
import { OPS_ASSISTANT_AGENT_ID, OPS_ASSISTANT_ROLE_KIND, listOpsTasks } from "@/lib/agents/ops-assistant-service"
import { canResolveAgentApproval, canStartAgentTask } from "@/lib/agents/authz"
import {
  TASK_CENTER_LIST_BLOCKED_MESSAGE,
  TASK_CENTER_LIST_UNAVAILABLE_MESSAGE,
  describeApprovalBadge,
  describeTaskListState,
  describeTaskPriorityBadge,
  describeTaskStatusBadge,
} from "@/lib/agents/task-center"
import type { AgentTask } from "@/lib/agents/types"
import { formatRunEventTime } from "@/lib/dashboard/format-run-event-time"
import { getCeoReport } from "@/lib/agents/ceo-report-service"
import { CeoReportPanel } from "@/components/dashboard/ceo-report-panel"
import { TaskCenterForm } from "./task-center"
import { TaskRowControls } from "./task-actions"

type MembershipRow = {
  organization_id: string
  role: "owner" | "admin" | "member" | "viewer"
  organizations: { name: string; slug: string } | { name: string; slug: string }[] | null
}

const STATE_TONE: Record<string, string> = {
  available: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  "optional-unconfigured": "border-white/15 bg-white/[.04] text-white/50",
  "optional-misconfigured": "border-amber-300/30 bg-amber-300/10 text-amber-100",
  "not-provisioned": "border-amber-300/30 bg-amber-300/10 text-amber-100",
}

const STATE_LABEL: Record<string, string> = {
  available: "Available",
  "optional-unconfigured": "Not configured",
  "optional-misconfigured": "Needs attention",
  "not-provisioned": "Not provisioned",
}

export default async function JarvisPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) redirect("/login")

  const { data, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations(name, slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
  if (membershipError) throw new Error("Unable to load workspace membership.")
  const membership = (data as MembershipRow[] | null)?.[0]
  if (!membership) redirect("/onboarding")
  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations
  if (!organization) throw new Error("Workspace organization could not be loaded.")

  // Read-only probe of the agent runtime tables. The migration that creates
  // them is prepared but may not be applied in this environment; a missing
  // table (or RLS denial) is reported honestly instead of crashing the page.
  let runtimeTablesProvisioned: boolean | null = null
  try {
    const { count, error: probeError } = await supabase
      .from("ai_agent_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", membership.organization_id)
    if (probeError) {
      runtimeTablesProvisioned = false
    } else {
      runtimeTablesProvisioned = (count ?? 0) >= 0
    }
  } catch {
    runtimeTablesProvisioned = null
  }

  const summary = getJarvisRuntimeSummary(process.env, { runtimeTablesProvisioned })

  // Task Center data. The list is only attempted when the probe did not prove
  // the tables missing; an empty list is shown as a true empty state ONLY when
  // persistence is confirmed, never when the migration is absent.
  const canCreate = canStartAgentTask(membership.role)
  const canApprove = canResolveAgentApproval(membership.role)
  const persistence: "available" | "blocked" | "unknown" =
    runtimeTablesProvisioned === true
      ? "available"
      : runtimeTablesProvisioned === false
        ? "blocked"
        : "unknown"
  let tasks: readonly AgentTask[] = []
  let taskListError: string | null = null
  if (runtimeTablesProvisioned !== false) {
    try {
      tasks = await listOpsTasks(userId)
    } catch {
      taskListError = TASK_CENTER_LIST_UNAVAILABLE_MESSAGE
    }
  }
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone
  const listState = describeTaskListState(tasks)

  // Read-only CEO report (task 62). Section-level failures are already handled
  // inside the service; this guard only covers an unexpected assembly error.
  let ceoReport: Awaited<ReturnType<typeof getCeoReport>> | null = null
  let ceoReportError: string | null = null
  try {
    ceoReport = await getCeoReport(membership.organization_id)
  } catch (error) {
    ceoReportError =
      error instanceof Error ? error.message : "Unable to assemble the CEO report."
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(124,58,237,.14),transparent_30rem),radial-gradient(circle_at_90%_60%,rgba(34,211,238,.08),transparent_28rem)]" />
      <div className="relative">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.035] p-6 shadow-2xl backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[.2em] text-cyan-300">
                  AI · Jarvis
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">
                  Jarvis
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                  Your internal operations assistant. It plans tasks with an
                  allowlisted toolset, asks a human before anything
                  consequential, and records every step. It is not autonomous.
                </p>
              </div>
              <span className="w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/50">
                Foundation · {organization.name}
              </span>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summary.capabilities.map((capability) => (
                <div
                  key={capability.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white/85">
                      {capability.label}
                    </p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATE_TONE[capability.state] ?? STATE_TONE["optional-unconfigured"]}`}
                    >
                      {STATE_LABEL[capability.state] ?? capability.state}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/60">
                    {capability.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CeoReportPanel
          report={ceoReport}
          errorMessage={ceoReportError}
          timeZone={timeZone}
        />

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[#090c12]/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
            <p className="text-xs uppercase tracking-[.18em] text-white/60">
              Active agent
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Operations Assistant
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/60">
              The first worker in the company hierarchy
              (<span className="text-white/60">{OPS_ASSISTANT_ROLE_KIND}</span>,
              id <span className="text-white/60">{OPS_ASSISTANT_AGENT_ID}</span>).
              It researches, summarises, drafts and reports — never sends.
              Drafts produced for outreach, payments or production changes
              always wait for an owner or admin to approve them.
            </p>
            <p className="mt-3 text-xs leading-5 text-white/60">
              Create and track tasks in the Task Center below. Approvers can
              resolve a pending gate (approve runs the plan immediately) and
              writers can explicitly run any queue-ready task; nothing starts
              on its own.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#090c12]/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
            <p className="text-xs uppercase tracking-[.18em] text-cyan-300">
              Tool registry
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              What Jarvis may use.
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {summary.tools.map((tool) => (
                <li key={tool.id} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tool.consequential ? "bg-amber-300" : "bg-cyan-300"}`}
                  />
                  <div>
                    <p className="text-xs font-medium text-white/70">
                      {tool.id}
                      {tool.consequential ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-200/80">
                          requires approval
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-white/60">
                      {tool.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#090c12]/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
          <p className="text-xs uppercase tracking-[.18em] text-cyan-300">
            Task Center
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Create and track tasks.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
            Every task is planned against the allowlisted toolset and executed
            in-process by the Operations Assistant. Nothing here is autonomous:
            consequential steps pause at an owner/admin approval gate.
          </p>

          <TaskCenterForm canCreate={canCreate} persistence={persistence} />

          <div className="mt-8">
            <p className="text-xs uppercase tracking-[.18em] text-white/60">
              Tasks
            </p>
            {persistence === "blocked" ? (
              <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm leading-5 text-amber-100">
                {TASK_CENTER_LIST_BLOCKED_MESSAGE}
              </p>
            ) : taskListError ? (
              <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-5 text-white/50">
                {taskListError}
              </p>
            ) : listState.kind === "empty" ? (
              <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-5 text-white/60">
                {listState.message}
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {tasks.map((task) => {
                  const status = describeTaskStatusBadge(task.status)
                  const approval = describeApprovalBadge(task.approvalState)
                  const priority = describeTaskPriorityBadge(task.priority)
                  return (
                    <li
                      key={task.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${status.tone}`}>
                          {status.label}
                        </span>
                        {approval ? (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${approval.tone}`}>
                            {approval.label}
                          </span>
                        ) : null}
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${priority.tone}`}>
                          {priority.label}
                        </span>
                        <span className="text-[11px] text-white/60">
                          {formatRunEventTime(task.createdAt, timeZone)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-white/85">{task.title}</p>
                      <p className="mt-1 text-xs leading-5 text-white/60">{task.objective}</p>
                      {task.errorMessage ? (
                        <p className="mt-2 text-xs leading-5 text-rose-300/90">
                          {task.errorMessage}
                        </p>
                      ) : null}
                      <TaskRowControls
                        taskId={task.id}
                        status={task.status}
                        approvalState={task.approvalState}
                        canApprove={canApprove}
                        canWrite={canCreate}
                        persistence={persistence}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
