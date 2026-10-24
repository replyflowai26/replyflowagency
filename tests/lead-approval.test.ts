/**
 * Secure admin approval + lead intake harness.
 *
 * Two layers are covered with ZERO database writes and ZERO network calls:
 *
 *   1. The PURE approval core (lead-approval-core.ts): request parsing,
 *      authorization (unauthenticated / non-admin / cross-tenant / stale gate)
 *      and the mapping from orchestrator outcome to a typed action response.
 *   2. The orchestrator paths the action drives (decideLeadApproval) against an
 *      in-memory Supabase substitute, so the action's semantics — approve,
 *      reject, duplicate/stale, concurrent, adapter failure — are exercised end
 *      to end. The outbound integration is an explicit mock.
 *
 * Plus source-inspection of the server action and the recovery sweep, because
 * a "use server" module (and a server-only recovery module) cannot be imported
 * into this harness.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  authorizeLeadApproval,
  isApproverRole,
  isLeadApprovalDecision,
  leadApprovalResponseForOutcome,
  LEAD_APPROVAL_APPROVER_ROLES,
  LEAD_APPROVAL_DECISIONS,
  LEAD_APPROVAL_ERROR_CODES,
  parseLeadApprovalRequest,
  type LeadApprovalActor,
  type LeadApprovalRunFacts,
} from "../src/lib/automation/lead-approval-core"
import { createMockNotificationAdapter } from "../src/lib/automation/integration-adapter"
import {
  decideLeadApproval,
  LEAD_CAPTURE_EVENTS,
  type LeadCaptureContext,
  type LeadCaptureDeps,
} from "../src/lib/automation/lead-capture-run"
import {
  buildLeadRunInput,
  parseLeadCaptureInput,
  qualifyLead,
  type NormalizedLead,
} from "../src/lib/leads/lead-capture"
import {
  isLeadIntakeBodyWithinLimit,
  LEAD_INTAKE_MAX_BODY_BYTES,
  parseLeadIntakeEnvelope,
} from "../src/lib/leads/lead-intake-core"
import { canTransitionRun, type WorkflowRunStatus } from "../src/lib/automation/run-state-machine"
import {
  APPROVAL_STATE_META,
  canResolveApproval,
  normalizeApprovalState,
} from "../src/lib/dashboard/run-observability-core"

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8")
}

const ORG = "11111111-1111-4111-8111-111111111111"
const OTHER_ORG = "99999999-9999-4999-8999-999999999999"
const PROJECT = "22222222-2222-4222-8222-222222222222"
const OTHER_PROJECT = "88888888-8888-4888-8888-888888888888"
const WF = "33333333-3333-4333-8333-333333333333"
const RUN = "44444444-4444-4444-8444-444444444444"
const NEW_RUN = "55555555-5555-4555-8555-555555555555"
const USER = "66666666-6666-4666-8666-666666666666"
const FIXED_TIME = "2026-01-01T00:00:00.000Z"

const CONTEXT: LeadCaptureContext = {
  organizationId: ORG,
  projectId: PROJECT,
  workflowId: WF,
  clientId: null,
}

const HOT_LEAD = {
  name: "Dana Buyer",
  email: "dana@acme-industrial.com",
  phone: "+1 (415) 555-0134",
  company: "Acme Industrial",
  message: "We need to automate inbound lead handling across three regional sales teams.",
  source: "referral",
}

// ─── Pure request parsing ─────────────────────────────────────────────────────

test("approval decisions are exactly approved or rejected", () => {
  assert.deepEqual([...LEAD_APPROVAL_DECISIONS], ["approved", "rejected"])
  assert.equal(isLeadApprovalDecision("approved"), true)
  assert.equal(isLeadApprovalDecision("rejected"), true)
  assert.equal(isLeadApprovalDecision("cancelled"), false)
  assert.equal(isLeadApprovalDecision("APPROVED"), false)
  assert.equal(isLeadApprovalDecision(1), false)
})

test("approver roles are narrower than runnable roles", () => {
  assert.deepEqual([...LEAD_APPROVAL_APPROVER_ROLES], ["owner", "admin"])
  assert.equal(isApproverRole("owner"), true)
  assert.equal(isApproverRole("admin"), true)
  assert.equal(isApproverRole("member"), false)
  assert.equal(isApproverRole(null), false)
})

test("parseLeadApprovalRequest accepts only projectId, runId and decision", () => {
  const ok = parseLeadApprovalRequest({
    projectId: PROJECT,
    runId: RUN,
    decision: "approved",
    // Attempted client-supplied privilege escalation must be ignored entirely.
    organizationId: OTHER_ORG,
    role: "owner",
    approvalState: "pending",
  })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.projectId, PROJECT)
    assert.equal(ok.runId, RUN)
    assert.equal(ok.decision, "approved")
    assert.deepEqual(Object.keys(ok).sort(), ["decision", "ok", "projectId", "runId"])
  }
})

test("parseLeadApprovalRequest rejects malformed requests", () => {
  const cases: unknown[] = [
    null,
    "approved",
    [],
    { projectId: PROJECT, runId: RUN, decision: "maybe" },
    { projectId: "not-a-uuid", runId: RUN, decision: "approved" },
    { projectId: PROJECT, runId: "nope", decision: "approved" },
    { runId: RUN, decision: "approved" },
  ]
  for (const raw of cases) {
    assert.equal(parseLeadApprovalRequest(raw).ok, false, JSON.stringify(raw))
  }
})

// ─── Pure authorization ───────────────────────────────────────────────────────

const adminActor: LeadApprovalActor = {
  userId: USER,
  membershipOrganizationId: ORG,
  membershipRole: "admin",
}

function pendingRun(overrides: Partial<LeadApprovalRunFacts> = {}): LeadApprovalRunFacts {
  return {
    organizationId: ORG,
    projectId: PROJECT,
    workflowId: WF,
    clientId: null,
    status: "queued",
    approvalState: "pending",
    ...overrides,
  }
}

test("an unauthenticated caller is refused (401)", () => {
  const result = authorizeLeadApproval({
    actor: { userId: null, membershipOrganizationId: null, membershipRole: null },
    expectedProjectId: PROJECT,
    run: pendingRun(),
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 401)
    assert.equal(result.code, LEAD_APPROVAL_ERROR_CODES.unauthenticated)
  }
})

test("a plain member is refused even for their own organization (403)", () => {
  const result = authorizeLeadApproval({
    actor: { userId: USER, membershipOrganizationId: ORG, membershipRole: "member" },
    expectedProjectId: PROJECT,
    run: pendingRun(),
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.status, 403)
})

test("an authenticated user with no membership is refused (403)", () => {
  const result = authorizeLeadApproval({
    actor: { userId: USER, membershipOrganizationId: null, membershipRole: null },
    expectedProjectId: PROJECT,
    run: pendingRun(),
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.status, 403)
})

test("a cross-tenant run reference is refused as not found (404)", () => {
  const result = authorizeLeadApproval({
    actor: adminActor,
    expectedProjectId: PROJECT,
    run: pendingRun({ organizationId: OTHER_ORG }),
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 404)
    assert.equal(result.code, LEAD_APPROVAL_ERROR_CODES.notFound)
  }
})

test("a run in another project is refused as not found (404)", () => {
  const result = authorizeLeadApproval({
    actor: adminActor,
    expectedProjectId: OTHER_PROJECT,
    run: pendingRun({ projectId: PROJECT }),
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.status, 404)
})

test("a missing run is refused as not found (404)", () => {
  const result = authorizeLeadApproval({
    actor: adminActor,
    expectedProjectId: PROJECT,
    run: null,
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.status, 404)
})

test("a stale decision (not queued or not pending) is refused (409)", () => {
  for (const run of [
    pendingRun({ status: "running" }),
    pendingRun({ status: "succeeded" }),
    pendingRun({ status: "queued", approvalState: "approved" }),
    pendingRun({ status: "queued", approvalState: "rejected" }),
    pendingRun({ status: "queued", approvalState: "none" }),
  ]) {
    const result = authorizeLeadApproval({
      actor: adminActor,
      expectedProjectId: PROJECT,
      run,
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.status, 409)
      assert.equal(result.code, LEAD_APPROVAL_ERROR_CODES.invalidState)
    }
  }
})

test("an owner or admin may resolve a still-pending run", () => {
  for (const role of ["owner", "admin"] as const) {
    const result = authorizeLeadApproval({
      actor: { userId: USER, membershipOrganizationId: ORG, membershipRole: role },
      expectedProjectId: PROJECT,
      run: pendingRun(),
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.run.projectId, PROJECT)
  }
})

// ─── Pure response mapping ────────────────────────────────────────────────────

test("orchestrator outcomes map to typed, non-leaking action responses", () => {
  assert.deepEqual(leadApprovalResponseForOutcome({ outcome: "approved", runId: RUN, providerRef: "ref" }), {
    ok: true,
    outcome: "approved",
    runId: RUN,
    providerRef: "ref",
  })
  assert.deepEqual(leadApprovalResponseForOutcome({ outcome: "cancelled", runId: RUN }), {
    ok: true,
    outcome: "cancelled",
    runId: RUN,
  })
  assert.deepEqual(leadApprovalResponseForOutcome({ outcome: "not_found" }), {
    ok: false,
    code: LEAD_APPROVAL_ERROR_CODES.notFound,
    status: 404,
    error: "Approval request not found.",
  })
  assert.deepEqual(leadApprovalResponseForOutcome({ outcome: "invalid_state", runId: RUN, status: "running" }), {
    ok: false,
    code: LEAD_APPROVAL_ERROR_CODES.invalidState,
    status: 409,
    error: "This approval is no longer pending.",
  })

  // The raw provider error must never reach the caller.
  const failed = leadApprovalResponseForOutcome({
    outcome: "failed",
    runId: RUN,
    errorCode: "INTEGRATION_DELIVERY_FAILED",
    errorMessage: "CRM timed out at https://internal.example/hook?token=secret",
  })
  assert.equal(failed.ok, false)
  if (!failed.ok) {
    assert.equal(failed.status, 502)
    assert.equal(failed.error.includes("internal.example"), false)
    assert.equal(failed.error.includes("secret"), false)
  }
})

// ─── Orchestrator paths the action drives (in-memory fake) ────────────────────

type Row = Record<string, any>

function createFakeSupabase(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    workflow_runs: [],
    workflow_run_events: [],
    ...initial,
  }

  const from = (table: string): any => {
    const filters: Array<{ col: string; val: unknown }> = []
    let pendingInsert: Row | null = null
    let pendingUpdate: Row | null = null

    const matched = (): Row[] =>
      (tables[table] ?? []).filter((row) => filters.every((f) => row[f.col] === f.val))

    const flush = () => {
      if (pendingInsert !== null) {
        ;(tables[table] ??= []).push(pendingInsert)
        pendingInsert = null
      }
      if (pendingUpdate !== null) {
        matched().forEach((row) => Object.assign(row, pendingUpdate))
        pendingUpdate = null
      }
      return null
    }

    const chain: any = {
      select: () => chain,
      eq(col: string, val: unknown) {
        filters.push({ col, val })
        return chain
      },
      insert(row: Row) {
        pendingInsert = { ...row }
        return chain
      },
      update(patch: Row) {
        pendingUpdate = patch
        return chain
      },
      async maybeSingle() {
        const rows = matched()
        const error = flush()
        return { data: error ? null : rows.length ? rows[0] : null, error }
      },
      then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve()
          .then(() => ({ data: null, error: flush() }))
          .then(onFulfilled, onRejected)
      },
    }
    return chain
  }

  const rpc = async (fn: string, args: Record<string, any>) => {
    if (fn !== "apply_workflow_run_transition") {
      return { data: null, error: { message: `unknown function ${fn}` } }
    }
    const runs = (tables.workflow_runs ??= [])
    const run = runs.find(
      (r) => r.id === args.p_run_id && r.organization_id === args.p_organization_id,
    )
    if (!run) {
      return { data: [{ outcome: "status_mismatch", run_id: args.p_run_id, previous_status: null, status: null }], error: null }
    }
    const previous = run.status
    if (previous === "succeeded" || previous === "failed" || previous === "cancelled") {
      return { data: [{ outcome: "already_terminal", run_id: run.id, previous_status: previous, status: previous }], error: null }
    }
    if (args.p_expected_status != null && previous !== args.p_expected_status) {
      return { data: [{ outcome: "status_mismatch", run_id: run.id, previous_status: previous, status: previous }], error: null }
    }
    if (!canTransitionRun(previous as WorkflowRunStatus, args.p_to_status as WorkflowRunStatus)) {
      return { data: [{ outcome: "invalid_transition", run_id: run.id, previous_status: previous, status: previous }], error: null }
    }
    run.status = args.p_to_status
    if (args.p_last_activity_at) run.last_activity_at = args.p_last_activity_at
    if (args.p_completed_at) run.completed_at = args.p_completed_at
    run.error_code = args.p_error_code ?? null
    run.error_message = args.p_error_message ?? null
    if (args.p_output !== null && args.p_output !== undefined) run.output = args.p_output
    ;(tables.workflow_run_events ??= []).push({
      organization_id: args.p_organization_id,
      run_id: run.id,
      event_type: args.p_event_type,
      message: args.p_event_message ?? null,
      payload: args.p_event_payload ?? {},
    })
    return { data: [{ outcome: "applied", run_id: run.id, previous_status: previous, status: run.status }], error: null }
  }

  return { tables, from, rpc }
}

function deps(
  fake: ReturnType<typeof createFakeSupabase>,
  notify = createMockNotificationAdapter(),
): LeadCaptureDeps {
  return {
    supabase: fake,
    notify,
    newId: () => NEW_RUN,
    now: () => new Date(FIXED_TIME),
  }
}

function seededApprovalRun(): Row {
  const parsed = parseLeadCaptureInput(HOT_LEAD)
  const lead = parsed.ok
    ? parsed.value
    : { name: "x", email: "x@acme.com", phone: null, company: null, message: null, source: "other" as const }
  const qualification = qualifyLead(lead as NormalizedLead)
  return {
    id: RUN,
    organization_id: ORG,
    status: "queued",
    approval_state: "pending",
    input: buildLeadRunInput(lead as NormalizedLead, qualification),
  }
}

// Mirrors the action: authorize against the server-read run facts, then call the
// orchestrator and map its outcome to the action response.
async function runAction(
  decision: "approved" | "rejected",
  fake: ReturnType<typeof createFakeSupabase>,
  notify = createMockNotificationAdapter(),
) {
  const facts = fake.tables.workflow_runs[0]
  const run: LeadApprovalRunFacts | null = facts
    ? {
        organizationId: facts.organization_id,
        projectId: PROJECT,
        workflowId: WF,
        clientId: null,
        status: facts.status,
        approvalState: facts.approval_state,
      }
    : null

  const authorized = authorizeLeadApproval({ actor: adminActor, expectedProjectId: PROJECT, run })
  if (!authorized.ok) {
    return { ok: false, code: authorized.code, status: authorized.status, error: authorized.error }
  }

  const outcome = await decideLeadApproval(RUN, decision, CONTEXT, deps(fake, notify))
  return leadApprovalResponseForOutcome(outcome)
}

test("valid approval delivers once and returns an ok response", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter({ providerRef: "mock://crm/approved" })
  const response = await runAction("approved", fake, notify)

  assert.deepEqual(response, { ok: true, outcome: "approved", runId: RUN, providerRef: "mock://crm/approved" })
  assert.equal(fake.tables.workflow_runs[0].status, "succeeded")
  assert.equal(notify.calls.length, 1)
})

test("rejection cancels the run and never dispatches delivery", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter()
  const response = await runAction("rejected", fake, notify)

  assert.deepEqual(response, { ok: true, outcome: "cancelled", runId: RUN })
  assert.equal(fake.tables.workflow_runs[0].status, "cancelled")
  assert.equal(notify.calls.length, 0, "a rejection must never contact the lead")
})

test("a repeated approval is refused without a second delivery", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter()
  await runAction("approved", fake, notify)
  const second = await runAction("approved", fake, notify)

  assert.equal(second.ok, false)
  if (!second.ok) assert.equal(second.status, 409)
  assert.equal(notify.calls.length, 1, "the consequential action must fire exactly once")
})

test("concurrent approvals resolve exactly once", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter()

  const [a, b] = await Promise.all([
    decideLeadApproval(RUN, "approved", CONTEXT, deps(fake, notify)),
    decideLeadApproval(RUN, "approved", CONTEXT, deps(fake, notify)),
  ])
  const outcomes = [a.outcome, b.outcome].sort()
  assert.deepEqual(outcomes, ["approved", "invalid_state"])
  assert.equal(notify.calls.length, 1)
})

test("an adapter failure surfaces a safe 502, never the raw provider error", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter({
    result: { ok: false, reason: "network", message: "CRM timed out." },
  })
  const response = await runAction("approved", fake, notify)

  assert.equal(response.ok, false)
  if (!response.ok) {
    assert.equal(response.status, 502)
    assert.equal(response.code, LEAD_APPROVAL_ERROR_CODES.failed)
  }
  assert.equal(fake.tables.workflow_runs[0].status, "failed")
})

// ─── Approver attribution in audit events (task 60) ───────────────────────────

function eventsOfType(
  fake: ReturnType<typeof createFakeSupabase>,
  eventType: string,
): Row[] {
  return fake.tables.workflow_run_events.filter((e) => e.event_type === eventType)
}

test("an approval decision event records the authenticated approver", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter({ providerRef: "mock://crm/approved" })
  const context: LeadCaptureContext = { ...CONTEXT, decidedByUserId: USER }

  const outcome = await decideLeadApproval(RUN, "approved", context, deps(fake, notify))
  assert.equal(outcome.outcome, "approved")

  const granted = eventsOfType(fake, LEAD_CAPTURE_EVENTS.approvalGranted)
  assert.equal(granted.length, 1)
  assert.equal(granted[0].payload.decided_by_user_id, USER)
})

test("a rejection event records the authenticated approver", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter()
  const context: LeadCaptureContext = { ...CONTEXT, decidedByUserId: USER }

  const outcome = await decideLeadApproval(RUN, "rejected", context, deps(fake, notify))
  assert.equal(outcome.outcome, "cancelled")

  const cancelled = eventsOfType(fake, LEAD_CAPTURE_EVENTS.cancelled)
  assert.equal(cancelled.length, 1)
  assert.equal(cancelled[0].payload.decided_by_user_id, USER)
  // No lead PII in the decision event.
  assert.equal(cancelled[0].payload.email, undefined)
  assert.equal(cancelled[0].payload.name, undefined)
})

test("a decision without an authenticated actor records null, never a guess", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter({ providerRef: "mock://crm/approved" })

  // The pre-task-60 CONTEXT (no decidedByUserId) must remain valid and the
  // event must honestly record null rather than omit or fabricate the field.
  const outcome = await decideLeadApproval(RUN, "approved", CONTEXT, deps(fake, notify))
  assert.equal(outcome.outcome, "approved")

  const granted = eventsOfType(fake, LEAD_CAPTURE_EVENTS.approvalGranted)
  assert.equal(granted.length, 1)
  assert.equal(granted[0].payload.decided_by_user_id, null)
  assert.ok("decided_by_user_id" in granted[0].payload, "the key must always be present")
})

test("the approval action threads the session user into the decision context", () => {
  // The server action must pass the session-derived actor id (never a
  // client-supplied one) into the orchestrator context that records the audit
  // attribution.
  assert.match(ACTION_SRC, /decidedByUserId:\s*actor\.userId/)
  // And the actor is still derived exclusively from the session claims.
  assert.match(ACTION_SRC, /supabase\.auth\.getClaims\(\)/)
})

// ─── Server action source inspection ──────────────────────────────────────────

const ACTION_SRC = readSource(
  "src/app/dashboard/projects/[id]/runs/[runId]/approval-actions.ts",
)

test("the approval action trusts only the session, never the request", () => {
  assert.match(ACTION_SRC, /"use server"/)
  assert.match(ACTION_SRC, /supabase\.auth\.getClaims\(\)/)
  assert.match(ACTION_SRC, /from\("organization_memberships"\)/)
  // Authorization is delegated to the pure core (owner/admin gate).
  assert.match(ACTION_SRC, /authorizeLeadApproval/)
  // Resolution goes through the existing server-side service.
  assert.match(ACTION_SRC, /resolveLeadApproval\(/)
  assert.match(ACTION_SRC, /revalidatePath/)
  // Only these three client fields are read.
  assert.match(ACTION_SRC, /formData\.get\("projectId"\)/)
  assert.match(ACTION_SRC, /formData\.get\("runId"\)/)
  assert.match(ACTION_SRC, /formData\.get\("decision"\)/)
})

test("the approval action never exposes secrets or bypasses the service", () => {
  assert.doesNotMatch(ACTION_SRC, /NEXT_PUBLIC_/)
  assert.doesNotMatch(ACTION_SRC, /SERVICE_ROLE/i)
  assert.doesNotMatch(ACTION_SRC, /createAdminClient/)
  // It must not perform the delivery itself; that is the orchestrator's job.
  assert.doesNotMatch(ACTION_SRC, /createHttpCrmAdapter/)
  assert.doesNotMatch(ACTION_SRC, /\bfetch\(/)
})

// ─── Pending-approval recovery safety ─────────────────────────────────────────

test("recovery never terminalizes a run held for approval", () => {
  const src = readSource("src/lib/automation/recovery-service.ts")
  // Excluded from the scan AND re-checked under the terminalize write.
  const guards = src.match(/\.neq\("approval_state", "pending"\)/g) ?? []
  assert.ok(guards.length >= 2, "expected the approval gate in both the scan and the write")
  // There must be no path that selects pending runs for terminalization.
  assert.doesNotMatch(src, /\.eq\("approval_state", "pending"\)/)
})

// ─── Inbound lead intake hardening ────────────────────────────────────────────

test("inbound lead intake rejects a malformed envelope", () => {
  for (const bad of [
    { organization_id: ORG, project_id: PROJECT, workflow_id: "bad", lead: {} },
    { organization_id: ORG, project_id: PROJECT, workflow_id: WF },
    { organization_id: ORG, project_id: PROJECT, workflow_id: WF, lead: [] },
  ]) {
    assert.equal(parseLeadIntakeEnvelope(bad).ok, false)
  }
})

test("inbound lead intake rejects an oversized body", () => {
  assert.equal(isLeadIntakeBodyWithinLimit(LEAD_INTAKE_MAX_BODY_BYTES + 1, 0), false)
  assert.equal(isLeadIntakeBodyWithinLimit(null, LEAD_INTAKE_MAX_BODY_BYTES + 1), false)
  assert.equal(isLeadIntakeBodyWithinLimit(LEAD_INTAKE_MAX_BODY_BYTES, LEAD_INTAKE_MAX_BODY_BYTES), true)
})

// ─── Approval gate view model (separate axis from run status) ─────────────────

test("approval state normalizes unknown and missing values to 'none'", () => {
  assert.equal(normalizeApprovalState("pending"), "pending")
  assert.equal(normalizeApprovalState("approved"), "approved")
  assert.equal(normalizeApprovalState("rejected"), "rejected")
  assert.equal(normalizeApprovalState("none"), "none")
  assert.equal(normalizeApprovalState(null), "none")
  assert.equal(normalizeApprovalState(undefined), "none")
  assert.equal(normalizeApprovalState("bogus"), "none")
  assert.equal(normalizeApprovalState(42), "none")
})

test("every approval state has a human label", () => {
  for (const state of ["none", "pending", "approved", "rejected"] as const) {
    assert.equal(typeof APPROVAL_STATE_META[state].label, "string")
    assert.ok(APPROVAL_STATE_META[state].label.length > 0)
  }
})

test("a run is resolvable only while queued and pending", () => {
  assert.equal(canResolveApproval("queued", "pending"), true)
  // Terminal or non-queued runs are never awaiting a decision.
  for (const status of ["running", "succeeded", "failed", "cancelled"] as const) {
    assert.equal(canResolveApproval(status, "pending"), false)
  }
  // A settled gate on a queued run is not resolvable.
  for (const state of ["none", "approved", "rejected"] as const) {
    assert.equal(canResolveApproval("queued", state), false)
  }
})

// ─── Database authorization boundary (migration source inspection) ────────────

const APPROVAL_BOUNDARY_MIGRATION = readSource(
  "supabase/migrations/20261007000000_restrict_workflow_run_transition_and_approval.sql",
)

test("the transition RPC requires an approver, not merely a member", () => {
  assert.match(
    APPROVAL_BOUNDARY_MIGRATION,
    /private\.has_org_role\(p_organization_id, v_actor_user_id, array\['owner', 'admin'\]\)/,
  )
  // The previous member-permissive predicate must be gone from the RPC branch.
  assert.doesNotMatch(
    APPROVAL_BOUNDARY_MIGRATION,
    /private\.is_org_member\(p_organization_id/,
  )
})

test("service_role stays trusted and the grant posture is re-asserted", () => {
  assert.match(APPROVAL_BOUNDARY_MIGRATION, /auth\.role\(\) <> 'service_role'/)
  assert.match(APPROVAL_BOUNDARY_MIGRATION, /to authenticated/)
  assert.match(APPROVAL_BOUNDARY_MIGRATION, /to service_role/)
})

test("a guard trigger protects approval_state from non-approvers", () => {
  assert.match(APPROVAL_BOUNDARY_MIGRATION, /workflow_runs_guard_approval_state/)
  assert.match(
    APPROVAL_BOUNDARY_MIGRATION,
    /new\.approval_state is distinct from old\.approval_state/,
  )
  assert.match(
    APPROVAL_BOUNDARY_MIGRATION,
    /before update on public\.workflow_runs/,
  )
  assert.match(
    APPROVAL_BOUNDARY_MIGRATION,
    /private\.has_org_role\(old\.organization_id, auth\.uid\(\), array\['owner', 'admin'\]\)/,
  )
})

test("the boundary migration never weakens RLS", () => {
  assert.doesNotMatch(APPROVAL_BOUNDARY_MIGRATION, /drop policy/i)
  assert.doesNotMatch(APPROVAL_BOUNDARY_MIGRATION, /disable row level security/i)
  assert.doesNotMatch(APPROVAL_BOUNDARY_MIGRATION, /alter policy/i)
})

// ─── Dashboard wiring (source inspection; server/client modules) ──────────────

const RUN_LIVE_SRC = readSource(
  "src/app/dashboard/projects/[id]/runs/[runId]/run-live.tsx",
)
const CONTROLS_SRC = readSource(
  "src/app/dashboard/projects/[id]/runs/[runId]/lead-approval-controls.tsx",
)
const RUN_PAGE_SRC = readSource(
  "src/app/dashboard/projects/[id]/runs/[runId]/page.tsx",
)
const RUN_OBSERVABILITY_SRC = readSource("src/lib/dashboard/run-observability.ts")

test("the run detail view renders approval controls only for a pending gate", () => {
  assert.match(RUN_LIVE_SRC, /LeadApprovalControls/)
  assert.match(RUN_LIVE_SRC, /canResolveApproval/)
  // Existing live-polling contract must survive the edit.
  assert.match(RUN_LIVE_SRC, /getRunSnapshotAction/)
  assert.match(RUN_LIVE_SRC, /POLL_INTERVAL_MS/)
  assert.match(RUN_LIVE_SRC, /isTerminalStatus/)
  assert.match(RUN_LIVE_SRC, /clearTimeout/)
})

test("approval controls submit only the three request fields to the server action", () => {
  assert.match(CONTROLS_SRC, /resolveLeadApprovalAction/)
  assert.match(CONTROLS_SRC, /formData\.set\("projectId", projectId\)/)
  assert.match(CONTROLS_SRC, /formData\.set\("runId", runId\)/)
  assert.match(CONTROLS_SRC, /formData\.set\("decision", decision\)/)
  // No direct database or secret access from the client component.
  assert.doesNotMatch(CONTROLS_SRC, /createClient/)
  assert.doesNotMatch(CONTROLS_SRC, /NEXT_PUBLIC_/)
  assert.doesNotMatch(CONTROLS_SRC, /SERVICE_ROLE/i)
})

test("approval controls always clear the loading state after settling", () => {
  // The button state must be reset on every settlement path. A `finally` block
  // guarantees this whether the action resolves with a result, resolves with an
  // error state, or throws, so a slow or hung snapshot request cannot leave the
  // controls stuck disabled.
  assert.match(CONTROLS_SRC, /finally \{/)
  assert.match(CONTROLS_SRC, /setSubmitting\(null\)/)
  // The follow-up refresh is fired only after settling and is never awaited.
  assert.match(CONTROLS_SRC, /void refresh\(\)/)
  assert.doesNotMatch(CONTROLS_SRC, /await onResolved\(\)/)
  // A ref guard prevents a fast repeated click slipping past before re-render.
  assert.match(CONTROLS_SRC, /inFlightRef/)
  assert.doesNotMatch(CONTROLS_SRC, /if \(submitting \|\| resolved\) return/)
})

test("the run page passes an approver flag derived from the session role", () => {
  assert.match(RUN_PAGE_SRC, /isApproverRole\(workspace\.role\)/)
  assert.match(RUN_PAGE_SRC, /canApprove=\{canApprove\}/)
})

test("run observability reads approval_state with a pre-migration fallback", () => {
  assert.match(RUN_OBSERVABILITY_SRC, /approval_state/)
  assert.match(RUN_OBSERVABILITY_SRC, /isMissingApprovalColumn/)
  assert.match(RUN_OBSERVABILITY_SRC, /normalizeApprovalState\(run\.approval_state\)/)
  // The disambiguated embeds required by the PGRST201 fix must remain.
  assert.match(
    RUN_OBSERVABILITY_SRC,
    /workflows!workflow_runs_workflow_id_organization_id_fkey\(id, name\)/,
  )
  assert.doesNotMatch(RUN_OBSERVABILITY_SRC, /workflows\(id, name\)/)
})
