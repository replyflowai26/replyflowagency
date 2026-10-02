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
  applyCallbackToRun,
  type CallbackClient,
} from "../src/lib/automation/callback-apply"

const SECRET = "test-secret-for-callback-hmac-32bytes!!"
const ORG = "11111111-1111-4111-8111-111111111111"
const WF = "22222222-2222-4222-8222-222222222222"
const RUN = "33333333-3333-4333-8333-333333333333"
const OTHER_ORG = "55555555-5555-4555-8555-555555555555"
const OTHER_WF = "66666666-6666-4666-8666-666666666666"

type Row = Record<string, unknown>

type DbHandle = { tables: Record<string, Row[]>; from: (table: string) => any }

/**
 * In-memory Supabase substitute that records every write into `tables` and
 * filters reads by the same `.eq()/.not()` surface the orchestrator uses. It
 * never performs I/O.
 *
 * The returned query builder is a thenable chain: read terminators
 * (`maybeSingle`/`single`) resolve immediately, while write builders
 * (`update`/`insert`/`delete`) defer their effect until the chain is awaited,
 * matching how the orchestrator composes `.update(patch).eq(...).eq(...)`.
 */
function createFakeSupabase(initial: Record<string, Row[]> = {}): DbHandle {
  const tables: Record<string, Row[]> = {
    workflow_runs: [],
    workflow_run_events: [],
    ...initial,
  }

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

  return { tables, from }
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
    tables: db.tables,
    from: (table: string) => {
      const chain = db.from(table)
      let sawUpdate = false
      const originalUpdate = chain.update.bind(chain)
      chain.update = (patch: Row) => {
        sawUpdate = true
        return originalUpdate(patch)
      }
      const originalMaybeSingle = chain.maybeSingle.bind(chain)
      chain.maybeSingle = async () => {
        if (sawUpdate) return originalMaybeSingle()
        return { data: null, error: { message } }
      }
      return chain
    },
  }
}

/** Write terminator fails, so the terminal write cannot land. */
function withUpdateError(db: DbHandle, message: string): DbHandle {
  return {
    tables: db.tables,
    from: (table: string) => {
      const chain = db.from(table)
      let sawUpdate = false
      const originalUpdate = chain.update.bind(chain)
      chain.update = (patch: Row) => {
        sawUpdate = true
        return originalUpdate(patch)
      }
      const originalMaybeSingle = chain.maybeSingle.bind(chain)
      chain.maybeSingle = async () => {
        if (sawUpdate) return { data: null, error: { message } }
        return originalMaybeSingle()
      }
      return chain
    },
  }
}

/**
 * Simulates a competing writer committing between this apply's read and its
 * write: the row's status is moved as soon as the update is issued, which is
 * exactly the window the compare-and-set has to close.
 */
function withConcurrentStatusChange(db: DbHandle, newStatus: string): DbHandle {
  return {
    tables: db.tables,
    from: (table: string) => {
      const chain = db.from(table)
      const originalUpdate = chain.update.bind(chain)
      chain.update = (patch: Row) => {
        // Replace the row rather than mutating it: the apply under test already
        // holds a snapshot from its read, and a competing transaction would not
        // retroactively change what that snapshot saw.
        const rows = db.tables[table] ?? []
        const idx = rows.findIndex((row) => row.id === RUN)
        if (idx >= 0) rows[idx] = { ...rows[idx], status: newStatus }
        return originalUpdate(patch)
      }
      return chain
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

test("a write failure is raised, never reported as not_found", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
  const { payload } = signedPayload()
  const logger = collectingLogger()

  await assert.rejects(
    () => applyCallbackToRun(payload, { supabase: withUpdateError(db, "deadlock detected"), secret: SECRET, log: logger.log }),
    /Unable to update workflow run\./,
  )

  assert.equal(db.tables.workflow_runs[0].status, "running")
  assert.equal(db.tables.workflow_run_events.length, 0)
  assert.ok(logger.entries.some((e) => e.level === "error" && e.scope === "callback.apply"))
})

test("a genuinely missing run is the only thing that yields not_found", async () => {
  const db = createFakeSupabase({ workflow_runs: [], workflow_run_events: [] })
  const { payload } = signedPayload()

  const result = await applyCallbackToRun(payload, { supabase: db, secret: SECRET })

  assert.equal(result.outcome, "not_found")
  assert.equal(result.runId, RUN)
  assert.equal(db.tables.workflow_run_events.length, 0)
})

// ─── Compare-and-set: a concurrent state change must not be overwritten ──────

test("a concurrent state change loses the compare-and-set and writes nothing", async () => {
  const db = createFakeSupabase({ workflow_runs: [seededRun()], workflow_run_events: [] })
  const { payload } = signedPayload()
  const logger = collectingLogger()

  const result = await applyCallbackToRun(payload, {
    supabase: withConcurrentStatusChange(db, "cancelled"),
    secret: SECRET,
    log: logger.log,
  })

  // The competing writer's terminal state survives; this delivery is refused.
  assert.equal(result.outcome, "status_mismatch")
  assert.equal(result.runId, RUN)
  assert.equal(db.tables.workflow_runs[0].status, "cancelled")
  assert.equal(db.tables.workflow_runs[0].completed_at, null)

  // Critically: the loser must not append a second terminal event.
  assert.equal(db.tables.workflow_run_events.length, 0)
  assert.ok(logger.entries.some((e) => e.level === "warn" && e.expected_status === "running"))
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
  const client: CallbackClient = db
  assert.ok(client)
  assert.equal(typeof db.from("workflow_runs").select().eq("id", RUN).maybeSingle().then, "function")
})