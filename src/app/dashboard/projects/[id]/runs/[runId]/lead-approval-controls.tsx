"use client"

import { useRef, useState } from "react"

import { resolveLeadApprovalAction } from "./approval-actions"

type Decision = "approved" | "rejected"

/**
 * Approve / reject controls for a hot lead held for human approval.
 *
 * This is a thin client shell around the authenticated server action. It never
 * talks to Supabase directly and never handles a credential: it submits only
 * `projectId`, `runId` and `decision`, and the server derives the actor, the
 * organization and the role from the session. All correctness (tenant scoping,
 * owner/admin authorization, single application of the decision) is enforced
 * server-side and in the database; the disabled state here is only UX.
 *
 * The loading state is cleared in a `finally` block, so it is reset on every
 * settlement path (a result, an error state, or a thrown exception). The
 * follow-up refresh is fired only AFTER the button state is settled and is never
 * awaited, so a slow or hung snapshot request can never leave the controls stuck
 * in a loading state.
 */
export function LeadApprovalControls({
  projectId,
  runId,
  canApprove,
  onResolved: refresh,
}: {
  projectId: string
  runId: string
  canApprove: boolean
  onResolved: () => void | Promise<void>
}) {
  const [submitting, setSubmitting] = useState<Decision | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolved, setResolved] = useState<Decision | null>(null)
  // Ref guard (not state) so a fast repeated click cannot slip past the guard
  // before the disabled attribute has re-rendered.
  const inFlightRef = useRef(false)

  if (!canApprove) {
    return (
      <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-4">
        <h2 className="text-sm font-semibold text-amber-100">
          Hot lead awaiting approval
        </h2>
        <p className="mt-1 text-xs text-amber-100/70">
          This high-value lead is held until an owner or admin approves outreach.
        </p>
      </section>
    )
  }

  async function submit(decision: Decision) {
    if (inFlightRef.current || resolved) return
    inFlightRef.current = true
    setError(null)
    setSubmitting(decision)

    try {
      const formData = new FormData()
      formData.set("projectId", projectId)
      formData.set("runId", runId)
      formData.set("decision", decision)

      const result = await resolveLeadApprovalAction(formData)

      if (result.ok) setResolved(decision)
      else setError(result.error)
    } catch {
      // Transport failure: let the user retry. The server action is idempotent,
      // so retrying after an ambiguous failure is safe.
      setError("Unable to resolve the approval. Please try again.")
    } finally {
      // Always clear the loading state, whether the action resolved with a
      // result, resolved with an error state, or threw.
      setSubmitting(null)
      inFlightRef.current = false
    }

    // Settle the button state FIRST, then refresh without blocking. A slow or
    // hung snapshot can no longer leave the controls disabled ("loading")
    // forever; the poll effect in the parent reconciles shortly anyway.
    void refresh()
  }

  return (
    <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-100">
            Hot lead awaiting approval
          </h2>
          <p className="mt-1 text-xs text-amber-100/70">
            Approving contacts the lead through the configured integration.
            Rejecting cancels the run and never contacts the lead.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => submit("rejected")}
            disabled={submitting !== null || resolved !== null}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting === "rejected" ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            onClick={() => submit("approved")}
            disabled={submitting !== null || resolved !== null}
            className="rounded-lg border border-cyan-300/25 bg-cyan-300/[.08] px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting === "approved" ? "Approving…" : "Approve"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-300/20 bg-red-300/[.04] px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      {resolved ? (
        <p className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/[.04] px-3 py-2 text-xs text-emerald-200">
          {resolved === "approved"
            ? "Approved — the lead will be delivered."
            : "Rejected — the run was cancelled."}
        </p>
      ) : null}
    </section>
  )
}
