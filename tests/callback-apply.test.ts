/**
 * Deterministic callback-apply harness.
 *
 * Exercises the full signed callback chain — HMAC sign → signature verify →
 * payload parse → apply — against an in-memory Supabase substitute.
 *
 * Guarantees:
 * - ZERO real database writes: no Supabase project is contacted, no network
 *   request is made, no .env.local is read.
 * - Deterministic: no timing, no polling, no external services. Finite and
 *   exits on its own.
 *
 * This is the mid-chain equivalent of the full local E2E (n8n → webhook →
 * callback) that is intentionally blocked from running until a separate
 * non-production Supabase project is provided.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  signCallbackPayload,
  verifyCallbackSignature,
  parseCallbackPayload,
} from "../src/lib/automation/callback-core"
import {
  canTransitionRun,
  isTerminalRunStatus,
  isWorkflowRunStatus,
} from "../src/lib/automation/run-state-machine"
import type { AtomicTransitionClient } from "../src/lib/automation/atomic-transition"
import {
  applyCallbackToRun,
  type CallbackClient,
  type CallbackOutcome,
} from "../src/lib/automation/callback-apply"

const SECRET = "test-secret-for-callback-hmac-32bytes!!"
const ORG = "11111111-1111-4111-8111-111111111111"
const WF = "22222222-2222-4222-8222-222222222222"
const RUN = "33333333-3333-4333-8333-333333333333"
const OTHER_ORG = "55555555-5555-4555-8555-555555555555"
const OTHER_WF = "66666666-6666-4666-8666-666666666666"

type Row = Record<string, unknown>

/**
 * The exact rpc() surface AtomicTransitionClient requires. Referencing the
 * contract instead of restating it keeps the fake and the real dependency in
 * lockstep by construction.
 */
type RpcFn = AtomicTransitionClient["rpc"]

/**
 * The four outcomes public.apply_workflow_run_transition can return, per the
 * function's return contract. Anything else is a database failure.
 */
type RpcOutcome =
  | "applied"
  | "already_terminal"
  | "status_mismatch"
  | "invalid_transition"

type RpcCall = { fn: string; args: Record<string, unknown> }

type DbHandle = {
  tables: Record<string, Row[]>
  from: (table: string) => any
  rpc: RpcFn
  /** Every rpc() call this handle received, in order. */
  rpcCalls: RpcCall[]
}

/**
 * In-memory Supabase substitute that records every write into `tables` and
 * filters reads by the same `.eq()/.not()` surface the orchestrator uses. It
 * never performs I/O.
 *
 * It serves exactly the two operations the orchestrator performs: a read of the
 * run row via `from()`/`maybeSingle()`, and the atomic transition via
 * `rpc("apply_workflow_run_transition", …)` — see the rpc implementation below
 * for how that mirrors the database function.
 *
 * The returned query builder is a thenable chain: read terminators
 * (`maybeSingle`/`single`) resolve immediately, while write builders
 * (`update`/`insert`/`delete`) defer their effect until the chain is awaited.
 */
function createFakeSupabase(initial: Record<string, Row[]> = {}): DbHandle {
  const tables: Record<string, Row[]> = {
    workflow_runs: [],
    workflow_run_events: [],
    ...initial,
  }

  const rpcCalls: RpcCall[] = []

  const from = (table: string): any => {
    const filters: Array<{ col: string; val: unknown; negate?: boolean }> = []
    let pendingPatch: Row | null = null
    let pendingInsert: Row | null = null
    let pendingDelete = false

    const applyFilters = (): Row[] =>
      (tables[table] ?? []).filter((row) =>
        filters.every((f) => (f.negate ? row[f.col] !== f.val : row[f.col] === f.val)),
      )

    // supabase-js applies a write as part of the same round trip that returns
    // the affected rows (UPDATE ... WHERE ... RETURNING), so the terminator
    // must flush pending writes before evaluating filters. `then()` does the
    // same for write chains that are awaited without a terminator.
    const flushWrites = (): void => {
      if (pendingInsert !== null) {
        ;(tables[table] ??= []).push(pendingInsert)
        pendingInsert = null
      }
      if (pendingDelete) {
        const rows = applyFilters()
        rows.forEach((row) => {
          const idx = tables[table]?.indexOf(row)
          if (idx !== undefined && idx >= 0) tables[table]?.splice(idx, 1)
        })
        pendingDelete = false
      }
      if (pendingPatch !== null) {
        // supabase-js serializes the update body as JSON, which drops
        // undefined values; mirror that so the fake matches production.
        const patch = Object.fromEntries(
          Object.entries(pendingPatch).filter(([, value]) => value !== undefined),
        )
        applyFilters().forEach((row) => Object.assign(row, patch))
        pendingPatch = null
      }
    }

    const chain: any = {
      select(): any {
        return chain
      },
      eq(col: string, val: unknown): any {
        filters.push({ col, val })
        return chain
      },
      not(col: string, _op: string, val: unknown): any {
        filters.push({ col, val, negate: true })
        return chain
      },
      update(patch: Row): any {
        pendingPatch = patch
        return chain
      },
      insert(row: Row): any {
        pendingInsert = row
        return chain
      },
      delete(): any {
        pendingDelete = true
        return chain
      },
      async maybeSingle(): Promise<{ data: Row | null; error: null }> {
        // WHERE is evaluated once, before the mutation, exactly like
        // `UPDATE ... WHERE ... RETURNING`. The matched row is returned by
        // reference, so it reflects the applied patch.
        const matched = applyFilters()
        flushWrites()
        return matched.length ? { data: matched[0], error: null } : { data: null, error: null }
      },
      async single(): Promise<{ data: Row | null; error: { message: string } | null }> {
        const matched = applyFilters()
        flushWrites()
        return matched.length === 1
          ? { data: matched[0], error: null }
          : { data: null, error: { message: "unexpected row count" } }
      },
      // Thenable so `await ...update(...).eq(...)` finalizes the write chain.
      then(
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ): Promise<unknown> {
        return (async (): Promise<{ error: null }> => {
          flushWrites()
          return { error: null }
        })().then(onFulfilled, onRejected)
      },
    }
    return chain
  }

  /**
   * In-memory stand-in for public.apply_workflow_run_transition. It mirrors the
   * function body in
   * supabase/migrations/20260917000011_atomic_workflow_run_transitions.sql:
   * argument validation, the (id, organization_id)-scoped row lock, the
   * terminal no-op, the compare-and-set against p_expected_status, the
   * transition check, and finally the run update and the audit insert that the
   * real function commits in one transaction.
   *
   * The fake is a faithful substitute, not a permissive one: an unrecognised
   * function name, an out-of-range status or a missing row all surface as an
   * error exactly as the real function raises one, so a mock that drifts from
   * the contract fails loudly instead of quietly passing.
   */
  const rpc: RpcFn = async (fn, args) => {
    rpcCalls.push({ fn, args })

    if (fn !== "apply_workflow_run_transition") {
      return { data: null, error: { message: `unexpected rpc function: ${fn}` } }
    }

    const runId = typeof args.p_run_id === "string" ? args.p_run_id : null
    const organizationId =
      typeof args.p_organization_id === "string" ? args.p_organization_id : null
    const toStatus = typeof args.p_to_status === "string" ? args.p_to_status : null
    const expectedStatus =
      typeof args.p_expected_status === "string" ? args.p_expected_status : null
    const eventType = typeof args.p_event_type === "string" ? args.p_event_type : null

    if (runId === null || organizationId === null || toStatus === null || eventType === null) {
      return { data: null, error: { message: "invalid argument" } }
    }

    // The function rejects a status the column check constraint would reject
    // anyway, as one predictable condition instead of a constraint violation
    // raised from inside the UPDATE.
    if (
      !isWorkflowRunStatus(toStatus) ||
      (expectedStatus !== null && !isWorkflowRunStatus(expectedStatus))
    ) {
      return { data: null, error: { message: "invalid target status" } }
    }

    // SELECT ... FOR UPDATE, scoped by (id, organization_id) so a transition can
    // never address another tenant's run. A missing row raises; it is not a
    // silent no-op.
    const runs = tables.workflow_runs
    const index = runs.findIndex(
      (row) => row.id === runId && row.organization_id === organizationId,
    )
    if (index < 0) {
      return { data: null, error: { message: "workflow run not found" } }
    }

    const run = runs[index]
    const previousStatus = typeof run.status === "string" ? run.status : null

    const respond = (outcome: RpcOutcome, status: string | null) => ({
      data: [{ outcome, run_id: runId, previous_status: previousStatus, status }],
      error: null,
    })

    // Idempotency: an already-terminal run is never moved again and never gains
    // a second terminal event.
    if (
      previousStatus !== null &&
      isWorkflowRunStatus(previousStatus) &&
      isTerminalRunStatus(previousStatus)
    ) {
      return respond("already_terminal", previousStatus)
    }

    // Compare-and-set: the caller must still be observing the exact status it
    // validated, otherwise it lost the race and must not write.
    if (expectedStatus !== null && expectedStatus !== previousStatus) {
      return respond("status_mismatch", previousStatus)
    }

    // Transition validation, mirroring TRANSITIONS in run-state-machine.ts.
    if (
      previousStatus === null ||
      !isWorkflowRunStatus(previousStatus) ||
      !canTransitionRun(previousStatus, toStatus)
    ) {
      return respond("invalid_transition", previousStatus)
    }

    // UPDATE ... SET. A supplied value overwrites; anything left null keeps the
    // existing row value via coalesce().
    const coalesce = (next: unknown, current: unknown): unknown =>
      next === null || next === undefined ? current : next

    Object.assign(run, {
      status: toStatus,
      started_at: coalesce(args.p_started_at, run.started_at),
      completed_at: coalesce(args.p_completed_at, run.completed_at),
      last_activity_at: coalesce(args.p_last_activity_at, new Date().toISOString()),
      external_execution_id: coalesce(
        args.p_external_execution_id,
        run.external_execution_id,
      ),
      output: coalesce(args.p_output, run.output),
      // Plain assignments rather than coalesce(), so a null clears the column.
      error_code: args.p_error_code ?? null,
      error_message: args.p_error_message ?? null,
      recovery_attempts: coalesce(args.p_recovery_attempts, run.recovery_attempts),
      recovery_started_at: coalesce(args.p_recovery_started_at, run.recovery_started_at),
      recovery_error: args.p_recovery_error ?? null,
    })

    // The audit insert shares the caller's transaction, so it lands here too:
    // a terminal state can never exist in the fake without its event, exactly
    // as in the database.
    const eventPayload = args.p_event_payload
    tables.workflow_run_events.push({
      organization_id: run.organization_id,
      run_id: run.id,
      event_type: eventType,
      message: typeof args.p_event_message === "string" ? args.p_event_message : null,
      payload:
        typeof eventPayload === "object" && eventPayload !== null ? eventPayload : {},
    })

    return respond("applied", toStatus)
  }

  return { tables, from, rpc, rpcCalls }
}

function seededRun(overrides: Row = {}): Row {
  return {
    id: RUN,
    organization_id: ORG,
    workflow_id: WF,
    status: "running",
    created_by: "44444444-4444-4444-8444-444444444444",
    external_execution_id: null,
    output: null,
    error_code: null,
    error_message: null,
    completed_at: null,
    last_activity_at: null,
    ...overrides,
  }
}

function signedPayload(overrides: Record<string, unknown> = {}): {
  raw: string
  payload: import("../src/lib/automation/callback-core").CallbackPayload
} {
  const body = {
    replyflow_run_id: RUN,
    organization_id: ORG,
    workflow_id: WF,
    status: "success",
    execution_id: "exec-1",
    output: { ok: true },
    error_message: null,
    error_code: null,
    occurred_at: "2026-09-05T12:00:00.000Z",
    ...overrides,
  }
  const raw = JSON.stringify(body)
  assert.equal(verifyCallbackSignature(SECRET, raw, signCallbackPayload(SECRET, raw)), true)
  const parsed = parseCallbackPayload(body)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) throw new Error("valid payload failed to parse")
  return { raw, payload: parsed.payload }
}

// ─── Happy path: success → applied ──────────────────────────────────────────

test("signed success callback applies the terminal state and records one event", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()] })
  const { payload } = signedPayload()

  const result = await applyCallbackToRun(payload, { supabase: db, secret: SECRET })

  assert.equal(result.outcome, "applied")
  assert.equal(result.runId, RUN)
  assert.equal(result.status, "succeeded")

  const run = db.tables.workflow_runs[0]
  assert.equal(run.status, "succeeded")
  assert.ok(run.completed_at)
  assert.ok(run.last_activity_at)
  assert.equal(run.external_execution_id, "exec-1")
  assert.deepEqual(run.output, { ok: true })
  assert.equal(run.error_code, null)
  assert.equal(run.error_message, null)

  assert.equal(db.tables.workflow_run_events.length, 1)
  const event = db.tables.workflow_run_events[0]
  assert.equal(event.event_type, "run.succeeded")
  assert.equal(event.run_id, RUN)
  assert.equal(event.organization_id, ORG)
})

test("a forged (wrong-secret) signature is rejected before any apply occurs", () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()] })
  const raw = JSON.stringify({
    replyflow_run_id: RUN,
    organization_id: ORG,
    workflow_id: WF,
    status: "success",
    execution_id: "exec-1",
    output: { ok: true },
    error_message: null,
    error_code: null,
    occurred_at: "2026-09-05T12:00:00.000Z",
  })
  // Wrong secret must fail signature verification, so the apply path is never
  // reached and no write can occur.
  assert.equal(verifyCallbackSignature("wrong-secret", raw, signCallbackPayload(SECRET, raw)), false)
  assert.deepEqual(db.tables.workflow_run_events, [])
})

// ─── Idempotency ────────────────────────────────────────────────────────────

test("duplicate callback for an already-terminal run is a no-op", async () => {
  const db = createFakeSupabase({
    workflow_runs: [seededRun({ status: "succeeded", completed_at: "2026-09-05T10:00:00.000Z" })],
    workflow_run_events: [],
  })
  const { payload } = signedPayload()

  const result = await applyCallbackToRun(payload, { supabase: db, secret: SECRET })

  assert.equal(result.outcome, "already_terminal")
  assert.equal(result.status, "succeeded")
  assert.equal(db.tables.workflow_run_events.length, 0)
  assert.equal(db.tables.workflow_runs[0].completed_at, "2026-09-05T10:00:00.000Z")
})

// ─── Tenant / forgery guards ────────────────────────────────────────────────

test("callback for an unknown organization id is not_found and writes nothing", async () => {
  const db = createFakeSupabase({
    workflow_runs: [seededRun({ organization_id: OTHER_ORG })],
    workflow_run_events: [],
  })
  const { payload } = signedPayload()

  const result = await applyCallbackToRun(payload, { supabase: db, secret: SECRET })

  assert.equal(result.outcome, "not_found")
  // Same as production: a missing row reports the requested run id.
  assert.equal(result.runId, RUN)
  assert.equal(db.tables.workflow_runs[0].status, "running")
  assert.equal(db.tables.workflow_run_events.length, 0)
})

test("callback referencing the wrong workflow is rejected as forge_attempt", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
  const { payload } = signedPayload({ workflow_id: OTHER_WF })

  const result = await applyCallbackToRun(payload, { supabase: db, secret: SECRET })

  assert.equal(result.outcome, "forge_attempt")
  assert.equal(result.runId, RUN)
  assert.equal(db.tables.workflow_runs[0].status, "running")
  assert.equal(db.tables.workflow_run_events.length, 0)
})

// ─── State machine guards ───────────────────────────────────────────────────

test("illegal queued→succeeded transition is a status_mismatch", async () => {
  const db = createFakeSupabase({
    workflow_runs: [seededRun({ status: "queued" })],
    workflow_run_events: [],
  })
  const { payload } = signedPayload()

  const result = await applyCallbackToRun(payload, { supabase: db, secret: SECRET })

  assert.equal(result.outcome, "status_mismatch")
  assert.equal(db.tables.workflow_runs[0].status, "queued")
  assert.equal(db.tables.workflow_run_events.length, 0)
})

// ─── Failure and cancellation paths ─────────────────────────────────────────

test("error callback marks the run failed with error fields and a run.failed event", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
  const { payload } = signedPayload({
    status: "error",
    execution_id: null,
    output: null,
    error_code: "WFE-42",
    error_message: "Workflow blew up",
  })

  const result = await applyCallbackToRun(payload, { supabase: db, secret: SECRET })

  assert.equal(result.outcome, "applied")
  assert.equal(result.status, "failed")
  const run = db.tables.workflow_runs[0]
  assert.equal(run.status, "failed")
  assert.ok(run.completed_at)
  assert.equal(run.error_code, "WFE-42")
  assert.equal(run.error_message, "Workflow blew up")
  assert.equal(run.output, null)
  assert.equal(run.external_execution_id, null)

  assert.equal(db.tables.workflow_run_events.length, 1)
  assert.equal(db.tables.workflow_run_events[0].event_type, "run.failed")
})

test("cancelled callback marks the run cancelled with a run.cancelled event", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
  const { payload } = signedPayload({ status: "cancelled", execution_id: "exec-2" })

  const result = await applyCallbackToRun(payload, { supabase: db, secret: SECRET })

  assert.equal(result.outcome, "applied")
  assert.equal(result.status, "cancelled")
  assert.equal(db.tables.workflow_runs[0].status, "cancelled")
  assert.equal(db.tables.workflow_run_events[0].event_type, "run.cancelled")
})

// ─── not_found means exactly "no such run" (HTTP 404 contract) ──────────────

/** Read terminator fails, so no run can be found. */
function withLoadError(db: DbHandle, message: string): DbHandle {
  return {
    ...db,
    from: (table: string) => {
      const chain = db.from(table)
      chain.maybeSingle = async () => ({ data: null, error: { message } })
      return chain
    },
  }
}

/**
 * The atomic RPC fails. Because the run update and its audit insert share one
 * transaction, this must leave the run untouched and emit no event.
 */
function withRpcError(db: DbHandle, message: string): DbHandle {
  return {
    ...db,
    rpc: async (fn, args) => {
      db.rpcCalls.push({ fn, args })
      return { data: null, error: { message } }
    },
  }
}

/**
 * Force the RPC to report one of its documented non-writing outcomes. Used to
 * pin the orchestrator's mapping of each outcome without having to invent a
 * distinct competing writer for every case.
 */
function withRpcOutcome(db: DbHandle, outcome: RpcOutcome, status: string): DbHandle {
  return {
    ...db,
    rpc: async (fn, args) => {
      db.rpcCalls.push({ fn, args })
      return {
        data: [
          {
            outcome,
            run_id: typeof args.p_run_id === "string" ? args.p_run_id : null,
            previous_status:
              typeof args.p_expected_status === "string" ? args.p_expected_status : null,
            status,
          },
        ],
        error: null,
      }
    },
  }
}

/**
 * Simulates a competing writer committing between this apply's read and its
 * write: the row's status is moved just before the RPC takes the row lock,
 * which is exactly the window the compare-and-set has to close.
 */
function withConcurrentStatusChange(db: DbHandle, newStatus: string): DbHandle {
  return {
    ...db,
    rpc: async (fn, args) => {
      // Replace the row rather than mutating it: the apply under test already
      // holds a snapshot from its read, and a competing transaction would not
      // retroactively change what that snapshot saw.
      const rows = db.tables.workflow_runs
      const idx = rows.findIndex((row) => row.id === RUN)
      if (idx >= 0) rows[idx] = { ...rows[idx], status: newStatus }
      return db.rpc(fn, args)
    },
  }
}

function collectingLogger(): { log: (...args: any[]) => void; entries: Row[] } {
  const entries: Row[] = []
  return {
    entries,
    log: (level: string, scope: string, message: string, _error?: unknown, meta?: Row) => {
      entries.push({ level, scope, message, ...(meta ?? {}) })
    },
  }
}

test("a read failure is raised, never reported as not_found (so 404 stays truthful)", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
  const { payload } = signedPayload()
  const logger = collectingLogger()

  await assert.rejects(
    () => applyCallbackToRun(payload, { supabase: withLoadError(db, "connection reset"), secret: SECRET, log: logger.log }),
    /Unable to load workflow run\./,
  )

  // A transient read failure must leave the run untouched and emit no event.
  assert.equal(db.tables.workflow_runs[0].status, "running")
  assert.equal(db.tables.workflow_run_events.length, 0)
  assert.ok(logger.entries.some((e) => e.level === "error" && e.scope === "callback.apply"))
})

test("an rpc failure is raised, never reported as not_found", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
  const { payload } = signedPayload()
  const logger = collectingLogger()

  await assert.rejects(
    () => applyCallbackToRun(payload, { supabase: withRpcError(db, "deadlock detected"), secret: SECRET, log: logger.log }),
    /Unable to apply workflow run transition\./,
  )

  // The update and the audit insert share one transaction, so a failed call
  // must leave the run untouched and emit no event.
  assert.equal(db.tables.workflow_runs[0].status, "running")
  assert.equal(db.tables.workflow_run_events.length, 0)
  assert.ok(logger.entries.some((e) => e.level === "error" && e.scope === "callback.apply"))
  // The database error must be reported, not swallowed into a generic outcome.
  assert.ok(logger.entries.some((e) => e.error_message === "deadlock detected"))
})

test("a genuinely missing run is the only thing that yields not_found", async () => {
  const db = createFakeSupabase({ workflow_runs: [], workflow_run_events: [] })
  const { payload } = signedPayload()

  const result = await applyCallbackToRun(payload, { supabase: db, secret: SECRET })

  assert.equal(result.outcome, "not_found")
  assert.equal(result.runId, RUN)
  assert.equal(db.tables.workflow_run_events.length, 0)
})

const RPC_PARAMETERS = [
  "p_run_id",
  "p_organization_id",
  "p_to_status",
  "p_event_type",
  "p_expected_status",
  "p_event_message",
  "p_event_payload",
  "p_external_execution_id",
  "p_output",
  "p_error_code",
  "p_error_message",
  "p_completed_at",
  "p_started_at",
  "p_last_activity_at",
  "p_recovery_attempts",
  "p_recovery_started_at",
  "p_recovery_error",
] as const

test("the transition rpc is sent only declared parameter names", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
  const { payload } = signedPayload()

  await applyCallbackToRun(payload, { supabase: db, secret: SECRET })

  assert.equal(db.rpcCalls.length, 1)
  const sent = Object.keys(db.rpcCalls[0].args)
  const declared = RPC_PARAMETERS as readonly string[]

  for (const key of sent) {
    assert.ok(declared.includes(key), `undeclared rpc argument: ${key}`)
  }

  assert.deepEqual(
    [...sent].sort(),
    [...RPC_PARAMETERS.slice(0, 14)].sort(),
  )
})

// ─── Compare-and-set: a concurrent state change must not be overwritten ──────

test("a concurrent terminal commit wins and this delivery writes nothing", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
  const { payload } = signedPayload()

  const result = await applyCallbackToRun(payload, {
    supabase: withConcurrentStatusChange(db, "cancelled"),
    secret: SECRET,
  })

  // The competing writer's terminal state survives and is reported back as
  // such; the RPC refuses a run that already reached a terminal state.
  assert.equal(result.outcome, "already_terminal")
  assert.equal(result.status, "cancelled")
  assert.equal(db.tables.workflow_runs[0].status, "cancelled")
  assert.equal(db.tables.workflow_runs[0].completed_at, null)

  // Critically: the loser must not append a second terminal event.
  assert.equal(db.tables.workflow_run_events.length, 0)

  // The compare-and-set must be armed with the status this delivery observed.
  assert.equal(db.rpcCalls.length, 1)
  assert.equal(db.rpcCalls[0].fn, "apply_workflow_run_transition")
  assert.equal(db.rpcCalls[0].args.p_expected_status, "running")
  assert.equal(db.rpcCalls[0].args.p_to_status, "succeeded")
})

test("a concurrent non-terminal commit loses the compare-and-set and writes nothing", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
  const { payload } = signedPayload()

  const result = await applyCallbackToRun(payload, {
    supabase: withConcurrentStatusChange(db, "queued"),
    secret: SECRET,
  })

  // The row is no longer at the status this delivery validated, so the RPC
  // refuses the write rather than overwriting a newer state.
  assert.equal(result.outcome, "status_mismatch")
  assert.equal(result.runId, RUN)
  assert.equal(db.tables.workflow_runs[0].status, "queued")
  assert.equal(db.tables.workflow_runs[0].completed_at, null)
  assert.equal(db.tables.workflow_run_events.length, 0)
  assert.equal(db.rpcCalls[0].args.p_expected_status, "running")
})

test("every documented non-writing rpc outcome is surfaced without writing", async () => {
  const cases: Array<{ outcome: RpcOutcome; expected: CallbackOutcome }> = [
    { outcome: "already_terminal", expected: "already_terminal" },
    { outcome: "status_mismatch", expected: "status_mismatch" },
    { outcome: "invalid_transition", expected: "status_mismatch" },
  ]

  for (const { outcome, expected } of cases) {
    const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
    const { payload } = signedPayload()

    const result = await applyCallbackToRun(payload, {
      supabase: withRpcOutcome(db, outcome, "cancelled"),
      secret: SECRET,
    })

    assert.equal(result.outcome, expected, outcome)
    assert.equal(result.status, "cancelled", outcome)
    // A non-writing outcome must leave the row and the timeline untouched.
    assert.equal(db.tables.workflow_runs[0].status, "running", outcome)
    assert.equal(db.tables.workflow_runs[0].completed_at, null, outcome)
    assert.equal(db.tables.workflow_run_events.length, 0, outcome)
  }
})

test("only the winner of a concurrent race writes the terminal state and one event", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
  const { payload } = signedPayload()

  // First delivery wins the compare-and-set and moves the run to succeeded.
  const first = await applyCallbackToRun(payload, { supabase: db, secret: SECRET })
  assert.equal(first.outcome, "applied")
  assert.equal(db.tables.workflow_runs[0].status, "succeeded")

  // A concurrent duplicate arriving afterwards must be inert: no state
  // regression, no second timeline event.
  const second = await applyCallbackToRun(payload, { supabase: db, secret: SECRET })
  assert.equal(second.outcome, "already_terminal")
  assert.equal(db.tables.workflow_runs[0].status, "succeeded")
  assert.equal(db.tables.workflow_run_events.length, 1)
  assert.equal(db.tables.workflow_run_events[0].event_type, "run.succeeded")
})

// ─── Harness structural integrity ───────────────────────────────────────────

test("fake supabase satisfies the CallbackClient contract", () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()] })
  // Assignment is the type check: it fails to compile if the fake drifts from
  // the rpc()/from() surface AtomicTransitionClient requires.
  const client: CallbackClient = db
  assert.ok(client)
  assert.equal(typeof client.rpc, "function")
  assert.equal(typeof db.from("workflow_runs").select().eq("id", RUN).maybeSingle().then, "function")
})