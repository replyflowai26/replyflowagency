import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  getRunDetail,
  getRunEvents,
  isTerminalStatus,
  triggerTypeLabel,
} from "@/lib/dashboard/run-observability"
import { RunLive } from "./run-live"

type Props = { params: Promise<{ id: string; runId: string }> }

type Membership = { organization_id: string; role: "owner" | "admin" | "member" | "viewer" }

function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return "—"
  }
}

function sanitizeErrorMessage(message: string | null): string | null {
  if (!message) return null
  const trimmed = message.trim()
  if (!trimmed) return null
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-3 sm:grid-cols-[12rem_1fr]">
      <dt className="text-xs uppercase tracking-wider text-white/25">{label}</dt>
      <dd className="min-w-0 text-sm text-white/70">{value}</dd>
    </div>
  )
}

export default async function RunDetailPage({ params }: Props) {
  const { id, runId } = await params
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) redirect("/login")

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) redirect("/onboarding")
  const workspace = membership as Membership

  const { data: project } = await supabase
    .from("automation_projects")
    .select("id, name")
    .eq("id", id)
    .eq("organization_id", workspace.organization_id)
    .maybeSingle()

  if (!project) notFound()

  const detail = await getRunDetail(workspace.organization_id, runId)
  if (!detail) notFound()

  if (detail.projectId !== project.id) notFound()

  const events = await getRunEvents(workspace.organization_id, runId, 50)
  const status = detail.status
  const canRun = ["owner", "admin", "member"].includes(workspace.role)
  const terminal = isTerminalStatus(status)
  const errorMessage = sanitizeErrorMessage(detail.errorMessage)

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[.2em] text-cyan-300">Run observability</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{detail.workflowName}</h1>
          <span className="text-sm text-white/30">{detail.shortId}</span>
        </div>
        <p className="mt-1 text-xs text-white/35">
          <Link href={`/dashboard/projects/${detail.projectId}`} className="text-cyan-200 transition hover:text-cyan-100">
            {detail.projectName}
          </Link>
          {" · "}
          {detail.clientName ? (
            <Link href={`/dashboard/clients/${detail.clientId}`} className="text-cyan-200 transition hover:text-cyan-100">
              {detail.clientName}
            </Link>
          ) : (
            "No linked client"
          )}
        </p>
      </div>

      <RunLive
        projectId={detail.projectId}
        initialRun={detail}
        initialEvents={events}
        canRun={!!terminal && canRun}
      />

      {status === "failed" ? (
        <section className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/[.04] p-5 backdrop-blur-xl">
          <h2 className="font-semibold text-red-100">Execution failed</h2>
          <p className="mt-1 text-xs text-white/40">The run did not complete successfully.</p>
          <div className="mt-4 grid gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/30">Timestamp</p>
              <p className="mt-1 text-white/70">{formatDateTime(detail.completedAt ?? detail.startedAt)}</p>
            </div>
            {detail.errorCode ? (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30">Error code</p>
                <p className="mt-1 text-white/70">{detail.errorCode}</p>
              </div>
            ) : null}
            {errorMessage ? (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30">Details</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-red-100">{errorMessage}</p>
              </div>
            ) : (
              <p className="text-white/40">No additional error details were recorded.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#090c12]/80">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="font-semibold">Run details</h2>
          <p className="mt-1 text-xs text-white/35">Execution context for this run.</p>
        </div>
        <dl className="divide-y divide-white/6 px-5 py-2">
          <MetaRow label="Workflow" value={detail.workflowName} />
          <MetaRow label="Project" value={detail.projectName} />
          <MetaRow label="Client" value={detail.clientName ?? "—"} />
          <MetaRow label="Status" value={status.charAt(0).toUpperCase() + status.slice(1)} />
          <MetaRow label="Trigger" value={triggerTypeLabel(detail.triggerType)} />
          <MetaRow
            label="External execution"
            value={detail.externalExecutionId ? detail.externalExecutionId : "Pending dispatch"}
          />
          <MetaRow label="Created" value={formatDateTime(detail.createdAt)} />
          <MetaRow label="Started" value={formatDateTime(detail.startedAt)} />
          <MetaRow label="Completed" value={formatDateTime(detail.completedAt)} />
        </dl>
      </section>
    </div>
  )
}
