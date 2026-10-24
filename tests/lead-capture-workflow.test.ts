/**
 * Lead-capture vertical-slice harness.
 *
 * Exercises, with ZERO database writes and ZERO network calls:
 *   raw payload → validate/normalize → deterministic qualification → durable
 *   run enqueue (in-memory Supabase substitute) → human approval gate →
 *   mock integration delivery → actionable failure.
 *
 * The integration adapter is an explicit mock (createMockNotificationAdapter).
 * No part of this suite contacts a real service.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  buildLeadRunInput,
  isBusinessEmail,
  leadCaptureOutput,
  leadIdempotencyKey,
  normalizePhone,
  parseLeadCaptureInput,
  qualifyLead,
  type NormalizedLead,
} from "../src/lib/leads/lead-capture"
import {
  createMockNotificationAdapter,
  createUnconfiguredIntegrationAdapter,
} from "../src/lib/automation/integration-adapter"
import {
  decideLeadApproval,
  handleInboundLead,
  LEAD_CAPTURE_ERROR_CODES,
  type LeadCaptureContext,
  type LeadCaptureDeps,
} from "../src/lib/automation/lead-capture-run"
import {
  canTransitionRun,
  type WorkflowRunStatus,
} from "../src/lib/automation/run-state-machine"
import {
  isLeadIntakeBodyWithinLimit,
  LEAD_INTAKE_MAX_BODY_BYTES,
  leadIntakeFingerprint,
  parseContentLength,
  parseLeadIntakeEnvelope,
  signLeadIntakePayload,
  verifyLeadIntakeSignature,
} from "../src/lib/leads/lead-intake-core"
import {
  createHttpCrmAdapter,
  normalizeCrmWebhookUrl,
} from "../src/lib/automation/integration-adapter"

const ORG = "11111111-1111-4111-8111-111111111111"
const PROJECT = "22222222-2222-4222-8222-222222222222"
const WF = "33333333-3333-4333-8333-333333333333"
const RUN = "44444444-4444-4444-8444-444444444444"
const NEW_RUN = "55555555-5555-4555-8555-555555555555"
const FIXED_TIME = "2026-01-01T00:00:00.000Z"

const CONTEXT: LeadCaptureContext = {
  organizationId: ORG,
  projectId: PROJECT,
  workflowId: WF,
  clientId: null,
}

type Row = Record<string, any>

type FakeOptions = {
  failInsertOn?: Record<string, { code?: string; message?: string } | null>
}

function createFakeSupabase(
  initial: Record<string, Row[]> = {},
  options: FakeOptions = {},
) {
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

    const flush = (): { code?: string; message?: string } | null => {
      if (pendingInsert !== null) {
        const forced = options.failInsertOn?.[table]
        if (forced) {
          pendingInsert = null
          return forced
        }
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
      then(
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve()
          .then(() => ({ data: null, error: flush() }))
          .then(onFulfilled, onRejected)
      },
    }
    return chain
  }

  /**
   * Emulates public.apply_workflow_run_transition: validate the transition
   * against the state machine, apply a compare-and-set on the observed status,
   * commit the terminal no-op case, and record the audit event in the SAME step
   * (mirroring the RPC's single-transaction contract).
   */
  const rpc = async (fn: string, args: Record<string, any>) => {
    if (fn !== "apply_workflow_run_transition") {
      return { data: null, error: { message: `unknown function ${fn}` } }
    }
    const runs = (tables.workflow_runs ??= [])
    const run = runs.find(
      (r) => r.id === args.p_run_id && r.organization_id === args.p_organization_id,
    )
    if (!run) {
      return {
        data: [{ outcome: "status_mismatch", run_id: args.p_run_id, previous_status: null, status: null }],
        error: null,
      }
    }
    const previous = run.status
    if (previous === "succeeded" || previous === "failed" || previous === "cancelled") {
      return {
        data: [{ outcome: "already_terminal", run_id: run.id, previous_status: previous, status: previous }],
        error: null,
      }
    }
    if (args.p_expected_status != null && previous !== args.p_expected_status) {
      return {
        data: [{ outcome: "status_mismatch", run_id: run.id, previous_status: previous, status: previous }],
        error: null,
      }
    }
    if (!canTransitionRun(previous as WorkflowRunStatus, args.p_to_status as WorkflowRunStatus)) {
      return {
        data: [{ outcome: "invalid_transition", run_id: run.id, previous_status: previous, status: previous }],
        error: null,
      }
    }
    run.status = args.p_to_status
    if (args.p_last_activity_at) run.last_activity_at = args.p_last_activity_at
    if (args.p_started_at) run.started_at = args.p_started_at
    if (args.p_completed_at) run.completed_at = args.p_completed_at
    if (args.p_external_execution_id) run.external_execution_id = args.p_external_execution_id
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
    return {
      data: [{ outcome: "applied", run_id: run.id, previous_status: previous, status: run.status }],
      error: null,
    }
  }

  return { tables, from, rpc }
}

function deps(
  fake: { from: (table: string) => any; rpc: (fn: string, args: Record<string, any>) => Promise<any>; tables: Record<string, Row[]> },
  notify = createMockNotificationAdapter(),
): LeadCaptureDeps & { notify: ReturnType<typeof createMockNotificationAdapter> } {
  return {
    supabase: fake,
    notify,
    newId: () => NEW_RUN,
    now: () => new Date(FIXED_TIME),
  }
}

const HOT_LEAD = {
  name: "Dana Buyer",
  email: "dana@acme-industrial.com",
  phone: "+1 (415) 555-0134",
  company: "Acme Industrial",
  message: "We need to automate inbound lead handling across three regional sales teams.",
  source: "referral",
}

const WARM_LEAD = { name: "Sam Prospect", email: "sam@brightlabs.io" }
const COLD_LEAD = { name: "Jo Casual", email: "jo@gmail.com" }

// ─── Validation / normalization ──────────────────────────────────────────────

test("parseLeadCaptureInput rejects malformed payloads with safe errors", () => {
  const cases: Array<{ label: string; raw: unknown }> = [
    { label: "non-object", raw: null },
    { label: "missing name", raw: { email: "a@b.com" } },
    { label: "short name", raw: { name: "A", email: "a@b.com" } },
    { label: "bad email", raw: { name: "Valid Name", email: "not-an-email" } },
    { label: "oversize name", raw: { name: "x".repeat(200), email: "a@b.com" } },
    { label: "bad phone", raw: { name: "Valid Name", email: "a@b.com", phone: "12" } },
  ]
  for (const { label, raw } of cases) {
    const result = parseLeadCaptureInput(raw)
    assert.equal(result.ok, false, `expected rejection for ${label}`)
    if (!result.ok) assert.ok(result.errors.length > 0)
  }
})

test("parseLeadCaptureInput normalizes a valid payload", () => {
  const result = parseLeadCaptureInput({
    name: "  Dana   Buyer ",
    email: "  DANA@Acme-Industrial.com ",
    phone: "+1 (415) 555-0134",
    company: "  Acme   Industrial ",
    message: " hello ",
    source: "REFERRAL",
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.name, "Dana Buyer")
    assert.equal(result.value.email, "dana@acme-industrial.com")
    assert.equal(result.value.phone, "+14155550134")
    assert.equal(result.value.company, "Acme Industrial")
    assert.equal(result.value.message, "hello")
    assert.equal(result.value.source, "referral")
  }
})

test("parseLeadCaptureInput defaults an unknown source to other", () => {
  const result = parseLeadCaptureInput({ name: "Valid Name", email: "a@b.com", source: "telepathy" })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.value.source, "other")
})

test("normalizePhone keeps 7-15 digits and drops junk", () => {
  assert.equal(normalizePhone("+1 (415) 555-0134"), "+14155550134")
  assert.equal(normalizePhone("415.555.0134"), "4155550134")
  assert.equal(normalizePhone("123"), null)
  assert.equal(normalizePhone("1234567890123456"), null)
  assert.equal(normalizePhone(null), null)
})

test("isBusinessEmail distinguishes business from consumer domains", () => {
  assert.equal(isBusinessEmail("a@acme.com"), true)
  assert.equal(isBusinessEmail("a@gmail.com"), false)
})

// ─── Deterministic qualification ─────────────────────────────────────────────

test("qualification is deterministic: hot, warm and cold tiers", () => {
  const hot = parseLeadCaptureInput(HOT_LEAD)
  const warm = parseLeadCaptureInput(WARM_LEAD)
  const cold = parseLeadCaptureInput(COLD_LEAD)
  assert.ok(hot.ok && warm.ok && cold.ok)
  if (!hot.ok || !warm.ok || !cold.ok) return

  const qHot = qualifyLead(hot.value)
  const qWarm = qualifyLead(warm.value)
  const qCold = qualifyLead(cold.value)

  assert.equal(qHot.tier, "hot")
  assert.equal(qHot.requiresApproval, true)
  assert.ok(qHot.score >= 70)
  assert.equal(qWarm.tier, "warm")
  assert.equal(qWarm.qualified, true)
  assert.equal(qWarm.requiresApproval, false)
  assert.equal(qCold.tier, "cold")
  assert.equal(qCold.qualified, false)

  // Stable across repeated calls.
  assert.deepEqual(qualifyLead(hot.value), qHot)
})

test("idempotency key is stable per identity and unique across identities", () => {
  const a = parseLeadCaptureInput(WARM_LEAD)
  const b = parseLeadCaptureInput({ ...WARM_LEAD, name: "Different Name" })
  const c = parseLeadCaptureInput({ name: "Sam Prospect", email: "sam@other.io" })
  assert.ok(a.ok && b.ok && c.ok)
  if (!a.ok || !b.ok || !c.ok) return

  assert.equal(leadIdempotencyKey(a.value), leadIdempotencyKey(b.value))
  assert.notEqual(leadIdempotencyKey(a.value), leadIdempotencyKey(c.value))
  assert.match(leadIdempotencyKey(a.value), /^lead:[0-9a-f]{64}$/)
})

test("run input and output envelopes carry the template identity and no fake client", () => {
  const parsed = parseLeadCaptureInput(WARM_LEAD)
  assert.ok(parsed.ok)
  if (!parsed.ok) return
  const qualification = qualifyLead(parsed.value)
  const input = buildLeadRunInput(parsed.value, qualification)
  assert.equal(input.template, "lead-capture-qualification")
  assert.equal(input.requires_approval, false)
  assert.deepEqual(
    Object.keys(leadCaptureOutput(parsed.value, qualification)).sort(),
    ["assigned_to", "client_id", "qualified", "score", "tier"],
  )
  const output = leadCaptureOutput(parsed.value, qualification)
  assert.equal(output.client_id, null)
  // The output envelope must never carry lead PII.
  assert.equal("email" in output, false)
})

// ─── Orchestration ───────────────────────────────────────────────────────────

test("a malformed lead is rejected and writes nothing", async () => {
  const fake = createFakeSupabase()
  const notify = createMockNotificationAdapter()
  const result = await handleInboundLead({ email: "bad" }, CONTEXT, deps(fake, notify))
  assert.equal(result.outcome, "rejected")
  assert.equal(fake.tables.workflow_runs.length, 0)
  assert.equal(fake.tables.workflow_run_events.length, 0)
  assert.equal(notify.calls.length, 0)
})

test("a valid lead is enqueued as a webhook run and delivered through the mock adapter", async () => {
  const fake = createFakeSupabase()
  const notify = createMockNotificationAdapter({ providerRef: "mock://crm/1" })
  const result = await handleInboundLead(WARM_LEAD, CONTEXT, deps(fake, notify))

  assert.equal(result.outcome, "enqueued")
  if (result.outcome === "enqueued") assert.equal(result.providerRef, "mock://crm/1")

  assert.equal(fake.tables.workflow_runs.length, 1)
  const run = fake.tables.workflow_runs[0]
  assert.equal(run.status, "succeeded")
  assert.equal(run.trigger_type, "webhook")
  assert.equal(run.organization_id, ORG)
  assert.equal(run.workflow_id, WF)
  assert.match(run.idempotency_key, /^lead:[0-9a-f]{64}$/)
  assert.equal(run.last_activity_at, FIXED_TIME)
  assert.equal(run.completed_at, FIXED_TIME)

  const eventTypes = fake.tables.workflow_run_events.map((e) => e.event_type)
  assert.deepEqual(eventTypes, [
    "run.queued",
    "run.dispatching",
    "run.integration_delivered",
  ])
  assert.equal(notify.calls.length, 1)
  assert.equal(notify.calls[0].provider, "crm")
  // No event payload may contain lead PII.
  for (const event of fake.tables.workflow_run_events) {
    const serialized = JSON.stringify(event.payload)
    assert.doesNotMatch(serialized, /dana|sam|@|415555/)
  }
})

test("a hot lead is gated: queued awaiting approval and NOT delivered", async () => {
  const fake = createFakeSupabase()
  const notify = createMockNotificationAdapter()
  const result = await handleInboundLead(HOT_LEAD, CONTEXT, deps(fake, notify))

  assert.equal(result.outcome, "awaiting_approval")
  assert.equal(fake.tables.workflow_runs[0].status, "queued")
  const eventTypes = fake.tables.workflow_run_events.map((e) => e.event_type)
  assert.deepEqual(eventTypes, ["run.queued", "run.approval_required"])
  assert.equal(notify.calls.length, 0, "consequential action must not fire before approval")
})

test("a duplicate lead does not create a second run", async () => {
  const parsed = parseLeadCaptureInput(WARM_LEAD)
  assert.ok(parsed.ok)
  if (!parsed.ok) return
  const key = leadIdempotencyKey(parsed.value)

  const fake = createFakeSupabase({
    workflow_runs: [
      { id: RUN, organization_id: ORG, idempotency_key: key, status: "queued" },
    ],
  })
  const notify = createMockNotificationAdapter()
  const result = await handleInboundLead(WARM_LEAD, CONTEXT, deps(fake, notify))

  assert.equal(result.outcome, "duplicate")
  if (result.outcome === "duplicate") assert.equal(result.runId, RUN)
  assert.equal(fake.tables.workflow_runs.length, 1)
  assert.equal(notify.calls.length, 0)
})

test("an enqueue race (unique violation) resolves to an idempotent duplicate", async () => {
  const parsed = parseLeadCaptureInput(WARM_LEAD)
  assert.ok(parsed.ok)
  if (!parsed.ok) return
  const key = leadIdempotencyKey(parsed.value)

  // The pre-check misses (no row yet), the insert conflicts, and the re-read
  // then finds the winner's run — exactly the concurrent-submission window.
  let selectCount = 0
  const fake = {
    tables: { workflow_runs: [{ id: RUN, organization_id: ORG, idempotency_key: key }] },
    from(table: string): any {
      if (table === "workflow_runs") {
        return {
          select: () => fake.from(table),
          eq: () => fake.from(table),
          insert() {
            return { then: (res: any) => Promise.resolve({ data: null, error: { code: "23505" } }).then(res) }
          },
          async maybeSingle() {
            selectCount += 1
            // First read (pre-check) misses; every later read finds the row.
            return { data: selectCount === 1 ? null : { id: RUN }, error: null }
          },
        }
      }
      return { insert: () => ({ then: (res: any) => Promise.resolve({ error: null }).then(res) }) }
    },
  }

  const result = await handleInboundLead(WARM_LEAD, CONTEXT, {
    supabase: fake as any,
    notify: createMockNotificationAdapter(),
    newId: () => NEW_RUN,
    now: () => new Date(FIXED_TIME),
  })
  assert.equal(result.outcome, "duplicate")
  if (result.outcome === "duplicate") assert.equal(result.runId, RUN)
})

test("a failed integration marks the run failed with an actionable error", async () => {
  const fake = createFakeSupabase()
  const notify = createMockNotificationAdapter({
    result: { ok: false, reason: "network", message: "CRM timed out." },
  })
  const result = await handleInboundLead(WARM_LEAD, CONTEXT, deps(fake, notify))

  assert.equal(result.outcome, "failed")
  const run = fake.tables.workflow_runs[0]
  assert.equal(run.status, "failed")
  assert.equal(run.error_code, LEAD_CAPTURE_ERROR_CODES.integrationFailed)
  assert.match(run.error_message, /CRM timed out/)
  assert.ok(run.completed_at)
  const eventTypes = fake.tables.workflow_run_events.map((e) => e.event_type)
  assert.deepEqual(eventTypes, ["run.queued", "run.dispatching", "run.failed"])
})

test("the unconfigured adapter fails honestly instead of faking delivery", async () => {
  const fake = createFakeSupabase()
  const result = await handleInboundLead(WARM_LEAD, CONTEXT, {
    supabase: fake,
    notify: createUnconfiguredIntegrationAdapter(),
    newId: () => NEW_RUN,
    now: () => new Date(FIXED_TIME),
  })
  assert.equal(result.outcome, "failed")
  assert.equal(fake.tables.workflow_runs[0].status, "failed")
})

// ─── Approval gate resolution ────────────────────────────────────────────────

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

test("approving a hot lead delivers it and records the approval", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter({ providerRef: "mock://crm/approved" })
  const result = await decideLeadApproval(RUN, "approved", CONTEXT, deps(fake, notify))

  assert.equal(result.outcome, "approved")
  assert.equal(notify.calls.length, 1)
  assert.equal(fake.tables.workflow_runs[0].status, "succeeded")
  assert.equal(fake.tables.workflow_runs[0].completed_at, FIXED_TIME)
  assert.equal(fake.tables.workflow_run_events[0].event_type, "run.approval_granted")
})

test("a repeat approval after delivery is refused and never double-delivers", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter()
  const first = await decideLeadApproval(RUN, "approved", CONTEXT, deps(fake, notify))
  const second = await decideLeadApproval(RUN, "approved", CONTEXT, deps(fake, notify))

  assert.equal(first.outcome, "approved")
  assert.equal(second.outcome, "invalid_state")
  assert.equal(notify.calls.length, 1, "the consequential action must fire exactly once")
})

test("rejecting a hot lead cancels the run and does not deliver", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter()
  const result = await decideLeadApproval(RUN, "rejected", CONTEXT, deps(fake, notify))

  assert.equal(result.outcome, "cancelled")
  assert.equal(fake.tables.workflow_runs[0].status, "cancelled")
  assert.equal(notify.calls.length, 0)
  assert.equal(fake.tables.workflow_run_events[0].event_type, "run.cancelled")
})

test("approval on an unknown run is not_found and writes nothing", async () => {
  const fake = createFakeSupabase()
  const result = await decideLeadApproval(RUN, "approved", CONTEXT, deps(fake))
  assert.equal(result.outcome, "not_found")
  assert.equal(fake.tables.workflow_run_events.length, 0)
})

test("approval on a non-queued run is refused (no double resolution)", async () => {
  const fake = createFakeSupabase({
    workflow_runs: [{ ...seededApprovalRun(), status: "succeeded" }],
  })
  const notify = createMockNotificationAdapter()
  const result = await decideLeadApproval(RUN, "approved", CONTEXT, deps(fake, notify))
  assert.equal(result.outcome, "invalid_state")
  assert.equal(notify.calls.length, 0)
})

test("concurrent approvals race on the gate: exactly one wins and delivers once", async () => {
  const fake = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter()

  const [a, b] = await Promise.all([
    decideLeadApproval(RUN, "approved", CONTEXT, deps(fake, notify)),
    decideLeadApproval(RUN, "approved", CONTEXT, deps(fake, notify)),
  ])

  const outcomes = [a.outcome, b.outcome].sort()
  assert.deepEqual(outcomes, ["approved", "invalid_state"])
  assert.equal(notify.calls.length, 1, "the consequential action must fire exactly once")
  assert.equal(fake.tables.workflow_runs[0].status, "succeeded")
})

test("an approval whose run was settled before the claim is refused and does not deliver", async () => {
  const base = createFakeSupabase({ workflow_runs: [seededApprovalRun()] })
  const notify = createMockNotificationAdapter()
  const fake = {
    tables: base.tables,
    from: base.from,
    // The queued -> running claim loses: recovery settled the run first.
    rpc: async (_fn: string, args: Record<string, any>) => ({
      data: [
        {
          outcome: "already_terminal",
          run_id: args.p_run_id,
          previous_status: "failed",
          status: "failed",
        },
      ],
      error: null,
    }),
  }

  const result = await decideLeadApproval(RUN, "approved", CONTEXT, {
    supabase: fake as any,
    notify,
    newId: () => NEW_RUN,
    now: () => new Date(FIXED_TIME),
  })

  assert.equal(result.outcome, "invalid_state")
  assert.equal(notify.calls.length, 0)
})

// ─── Lead intake envelope + cryptography ─────────────────────────────────────

test("lead intake envelope validates routing ids and requires a lead object", () => {
  const valid = parseLeadIntakeEnvelope({
    organization_id: ORG,
    project_id: PROJECT,
    workflow_id: WF,
    lead: { name: "Valid Name", email: "a@b.com" },
  })
  assert.equal(valid.ok, true)
  if (valid.ok) assert.equal(valid.envelope.clientId, null)

  for (const bad of [
    null,
    [],
    { organization_id: "nope", project_id: PROJECT, workflow_id: WF, lead: {} },
    { organization_id: ORG, project_id: PROJECT, workflow_id: WF },
    { organization_id: ORG, project_id: PROJECT, workflow_id: WF, lead: "x" },
    { organization_id: ORG, project_id: PROJECT, workflow_id: WF, client_id: "bad", lead: {} },
  ]) {
    assert.equal(parseLeadIntakeEnvelope(bad).ok, false)
  }
})

test("lead intake signatures round-trip and reject tampering", () => {
  const secret = "intake-secret"
  const body = JSON.stringify({ organization_id: ORG, lead: { email: "a@b.com" } })
  const signature = signLeadIntakePayload(secret, body)
  assert.match(signature, /^sha256=[0-9a-f]{64}$/)

  assert.equal(verifyLeadIntakeSignature(secret, body, signature), true)
  assert.equal(verifyLeadIntakeSignature(secret, body + " ", signature), false)
  assert.equal(verifyLeadIntakeSignature("other-secret", body, signature), false)
  assert.equal(verifyLeadIntakeSignature(secret, body, null), false)
  assert.equal(verifyLeadIntakeSignature(undefined, body, signature), false)

  const fingerprint = leadIntakeFingerprint(secret, body)
  assert.match(fingerprint, /^sha256=[0-9a-f]{16}$/)
  assert.equal(leadIntakeFingerprint(secret, body), fingerprint)
  assert.equal(fingerprint.includes("a@b.com"), false)
})

// ─── Outbound HTTP CRM adapter (fake fetch; no live calls) ────────────────────

const CRM_DELIVERY = {
  provider: "crm" as const,
  operation: "notify" as const,
  reference: "dana@acme-industrial.com",
  payload: { company: "Acme Industrial" },
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

test("HTTP CRM adapter signs, idempotently keys and reports the provider ref", async () => {
  const calls: Array<{ url: string; init: any }> = []
  const adapter = createHttpCrmAdapter({
    url: "https://crm.example.com/hooks/lead",
    secret: "crm-secret",
    sleep: async () => {},
    fetchFn: (async (url: any, init: any) => {
      calls.push({ url, init })
      return jsonResponse(200, { id: "crm-123" })
    }) as any,
  })

  const result = await adapter.deliver(CRM_DELIVERY)
  assert.deepEqual(result, { ok: true, providerRef: "crm-123" })
  assert.equal(calls.length, 1)

  const init = calls[0].init
  assert.equal(calls[0].url, "https://crm.example.com/hooks/lead")
  assert.equal(init.method, "POST")
  assert.equal(init.headers["content-type"], "application/json")
  assert.match(init.headers["x-replyflow-signature"], /^sha256=[0-9a-f]{64}$/)
  assert.match(init.headers["idempotency-key"], /^[0-9a-f]{64}$/)
  // The signature must verify against the exact transmitted body.
  assert.equal(
    signLeadIntakePayload("crm-secret", init.body),
    init.headers["x-replyflow-signature"],
  )
  // The idempotency key must not leak the raw reference.
  assert.equal(init.headers["idempotency-key"].includes("dana@"), false)
})

test("HTTP CRM adapter treats 4xx as a non-retryable rejection", async () => {
  let count = 0
  const adapter = createHttpCrmAdapter({
    url: "https://crm.example.com/hooks/lead",
    secret: "crm-secret",
    maxRetries: 3,
    sleep: async () => {},
    fetchFn: (async () => {
      count += 1
      return jsonResponse(422, { error: "unprocessable" })
    }) as any,
  })
  const result = await adapter.deliver(CRM_DELIVERY)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "rejected")
  assert.equal(count, 1, "a client error must not be retried")
})

test("HTTP CRM adapter retries 5xx then reports unavailable", async () => {
  let count = 0
  const adapter = createHttpCrmAdapter({
    url: "https://crm.example.com/hooks/lead",
    secret: "crm-secret",
    maxRetries: 2,
    sleep: async () => {},
    fetchFn: (async () => {
      count += 1
      return jsonResponse(503, {})
    }) as any,
  })
  const result = await adapter.deliver(CRM_DELIVERY)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "unavailable")
  assert.equal(count, 3, "one attempt plus two retries")
})

test("HTTP CRM adapter retries network errors then reports network", async () => {
  let count = 0
  const adapter = createHttpCrmAdapter({
    url: "https://crm.example.com/hooks/lead",
    secret: "crm-secret",
    maxRetries: 1,
    sleep: async () => {},
    fetchFn: (async () => {
      count += 1
      throw new Error("socket hang up")
    }) as any,
  })
  const result = await adapter.deliver(CRM_DELIVERY)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "network")
  assert.equal(count, 2)
})

test("HTTP CRM adapter aborts a hung attempt and reports a timeout", async () => {
  const adapter = createHttpCrmAdapter({
    url: "https://crm.example.com/hooks/lead",
    secret: "crm-secret",
    timeoutMs: 100,
    maxRetries: 0,
    fetchFn: ((_url: any, init: any) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
        })
      })) as any,
  })
  const result = await adapter.deliver(CRM_DELIVERY)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.reason, "network")
    assert.match(result.message, /timed out/)
  }
})

test("CRM webhook URL validation requires https and rejects credentials", () => {
  assert.equal(normalizeCrmWebhookUrl("https://crm.example.com/hooks/lead"), "https://crm.example.com/hooks/lead")
  assert.equal(normalizeCrmWebhookUrl("http://localhost:4000/hook"), "http://localhost:4000/hook")
  assert.equal(normalizeCrmWebhookUrl("http://127.0.0.1:4000/hook"), "http://127.0.0.1:4000/hook")
  // Plaintext to a remote host would leak lead PII.
  assert.equal(normalizeCrmWebhookUrl("http://crm.example.com/hook"), null)
  // A secret must never be smuggled through the URL.
  assert.equal(normalizeCrmWebhookUrl("https://user:pass@crm.example.com/hook"), null)
  assert.equal(normalizeCrmWebhookUrl("not a url"), null)
})

test("lead intake body size guard rejects oversized payloads by header or actual size", () => {
  assert.equal(parseContentLength("1024"), 1024)
  assert.equal(parseContentLength(" 2048 "), 2048)
  assert.equal(parseContentLength(null), null)
  assert.equal(parseContentLength("abc"), null)
  assert.equal(parseContentLength("-5"), null)

  assert.equal(isLeadIntakeBodyWithinLimit(1024, 1024), true)
  assert.equal(isLeadIntakeBodyWithinLimit(null, LEAD_INTAKE_MAX_BODY_BYTES), true)
  // Declared length too large: reject before reading.
  assert.equal(isLeadIntakeBodyWithinLimit(LEAD_INTAKE_MAX_BODY_BYTES + 1, 0), false)
  // Actual length too large even though the header was absent.
  assert.equal(isLeadIntakeBodyWithinLimit(null, LEAD_INTAKE_MAX_BODY_BYTES + 1), false)
  // A spoofed small header cannot bypass the actual-size check.
  assert.equal(isLeadIntakeBodyWithinLimit(10, LEAD_INTAKE_MAX_BODY_BYTES + 1), false)
})
