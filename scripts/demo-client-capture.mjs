// Client-ready lead-capture demo (local, self-contained, NO network, NO DB).
//
// WHAT THIS SHOWS (the exact story you can walk a client through)
//   A raw inbound lead travels the REAL orchestration + REAL outbound adapter:
//     validate/normalize → deterministic qualification → durable run "enqueue"
//     (in-memory Supabase substitute) → human approval gate → signed, idempotent
//     HTTP delivery to a CRM webhook → retries → actionable failure → report.
//
//   Unlike demo-lead-capture.mjs this uses the REAL createHttpCrmAdapter. The
//   HTTP endpoint is simulated by an injected fetch, and the retry backoff sleep
//   is injected, so the demo is instant and deterministic while proving the real
//   signing, idempotency-key and retry/timeout logic.
//
// WHAT THIS DOES NOT DO (deliberately)
//   - No database, no real network, no n8n, no secrets. Everything is in-memory.
//   - No production module is imported directly: it loads the compiled pure
//     modules from .test-dist (run via `npm run demo:client-capture`).
//
// The same code paths are covered by tests/lead-capture-workflow.test.ts.

import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))
const dist = (p) => resolve(REPO_ROOT, ".test-dist/src/lib", p)

const leads = require(dist("leads/lead-capture.js"))
const runs = require(dist("automation/lead-capture-run.js"))
const adapters = require(dist("automation/integration-adapter.js"))

const ORG = "11111111-1111-4111-8111-111111111111"
const PROJECT = "22222222-2222-4222-8222-222222222222"
const WF = "33333333-3333-4333-8333-333333333333"
const CONTEXT = { organizationId: ORG, projectId: PROJECT, workflowId: WF, clientId: null }

// ── In-memory Supabase substitute (only the builder calls the orchestrator uses)
function createFakeSupabase() {
  const tables = { workflow_runs: [], workflow_run_events: [] }
  let ids = 0
  const from = (table) => {
    const filters = []
    let pendingInsert = null
    let pendingUpdate = null
    const matched = () => (tables[table] ?? []).filter((r) => filters.every((f) => r[f.col] === f.val))
    const flush = () => {
      if (pendingInsert) {
        tables[table].push(pendingInsert)
        pendingInsert = null
      }
      if (pendingUpdate) {
        matched().forEach((r) => Object.assign(r, pendingUpdate))
        pendingUpdate = null
      }
    }
    const chain = {
      select: () => chain,
      eq(col, val) {
        filters.push({ col, val })
        return chain
      },
      insert(row) {
        pendingInsert = { ...row }
        return chain
      },
      update(patch) {
        pendingUpdate = patch
        return chain
      },
      async maybeSingle() {
        const rows = matched()
        flush()
        return { data: rows.length ? rows[0] : null, error: null }
      },
      then(onFulfilled) {
        return Promise.resolve()
          .then(() => {
            flush()
            return { data: null, error: null }
          })
          .then(onFulfilled)
      },
    }
    return chain
  }
  // Emulates public.apply_workflow_run_transition (the atomic transition RPC the
  // orchestrator uses for every state change).
  const rpc = async (fn, args) => {
    if (fn !== "apply_workflow_run_transition") {
      return { data: null, error: { message: `unknown function ${fn}` } }
    }
    const run = (tables.workflow_runs ?? []).find(
      (r) => r.id === args.p_run_id && r.organization_id === args.p_organization_id,
    )
    if (!run) {
      return { data: [{ outcome: "status_mismatch", run_id: args.p_run_id, previous_status: null, status: null }], error: null }
    }
    const previous = run.status
    const terminal = previous === "succeeded" || previous === "failed" || previous === "cancelled"
    if (terminal) {
      return { data: [{ outcome: "already_terminal", run_id: run.id, previous_status: previous, status: previous }], error: null }
    }
    if (args.p_expected_status != null && previous !== args.p_expected_status) {
      return { data: [{ outcome: "status_mismatch", run_id: run.id, previous_status: previous, status: previous }], error: null }
    }
    run.status = args.p_to_status
    if (args.p_last_activity_at) run.last_activity_at = args.p_last_activity_at
    if (args.p_completed_at) run.completed_at = args.p_completed_at
    run.error_code = args.p_error_code ?? null
    run.error_message = args.p_error_message ?? null
    if (args.p_output !== null && args.p_output !== undefined) run.output = args.p_output
    tables.workflow_run_events.push({
      organization_id: args.p_organization_id,
      run_id: run.id,
      event_type: args.p_event_type,
      message: args.p_event_message ?? null,
      payload: args.p_event_payload ?? {},
    })
    return { data: [{ outcome: "applied", run_id: run.id, previous_status: previous, status: run.status }], error: null }
  }
  return { tables, from, rpc, nextId: () => `demo-run-${String(++ids).padStart(3, "0")}` }
}

// ── Simulated CRM webhook endpoint
const crmRequests = []
const crmAttempts = {}
function createSimulatedCrmFetch() {
  return async (url, init) => {
    const parsed = JSON.parse(init.body)
    const ref = String(parsed.reference || "")
    crmAttempts[ref] = (crmAttempts[ref] || 0) + 1
    crmRequests.push({ url, reference: ref, attempt: crmAttempts[ref], headers: init.headers, body: init.body })

    if (ref.includes("hang")) {
      // Accept the connection, then never respond until the adapter aborts.
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        )
      })
    }
    if (ref.includes("always-down")) {
      return { ok: false, status: 500, json: async () => ({ error: "crm down" }) }
    }
    if (ref.includes("flaky")) {
      // Fail twice, succeed on the third (last) attempt.
      if (crmAttempts[ref] < 3) return { ok: false, status: 503, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => ({ id: `crm-flaky-${crmAttempts[ref]}` }) }
    }
    return { ok: true, status: 200, json: async () => ({ id: `crm-${ref.split("@")[0]}` }) }
  }
}

function line(label, value) {
  console.log(`  ${label.padEnd(24)} ${value}`)
}

function showRun(supabase, runId) {
  const run = supabase.tables.workflow_runs.find((r) => r.id === runId)
  const events = supabase.tables.workflow_run_events.filter((e) => e.run_id === runId)
  console.log(`\n  run ${runId}`)
  line("status", run.status)
  line("approval_state", run.approval_state)
  line("tier / score", `${run.input.qualification.tier} / ${run.input.qualification.score}`)
  line("timeline", events.map((e) => e.event_type).join("  ->  "))
  if (run.error_code) line("error", `${run.error_code}: ${run.error_message}`)
  return run
}

const WARM = { name: "Sam Prospect", email: "sam@brightlabs.io", source: "website" }
const HOT = {
  name: "Dana Buyer",
  email: "dana@acme-industrial.com",
  phone: "+1 (415) 555-0134",
  company: "Acme Industrial",
  message: "We need to automate inbound lead handling across three regional sales teams.",
  source: "referral",
}
const FLAKY = { name: "Maria Retry", email: "maria@flaky-corp.com", phone: "4155550199" }
const DOWN = { name: "Bob Down", email: "bob@always-down-corp.com", phone: "4155550177" }
const HANG = { name: "Carl Hang", email: "carl@hang-corp.com", phone: "4155550188" }
const SPAM = { name: "x", email: "not-an-email" }

async function main() {
  const supabase = createFakeSupabase()

  // The REAL outbound adapter. The endpoint + secret are explicit; the transport
  // (fetch) and backoff (sleep) are injected so no real network call is made and
  // the demo runs instantly.
  const crm = adapters.createHttpCrmAdapter({
    url: "https://crm.acme-corp.example/hooks/replyflow",
    secret: "demo-crm-shared-secret",
    timeoutMs: 200,
    maxRetries: 2,
    sleep: async () => {},
    fetchFn: createSimulatedCrmFetch(),
  })

  const deps = {
    supabase,
    notify: crm,
    newId: supabase.nextId,
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  }

  console.log("\nReplyFlow AI · client lead-capture demo")
  console.log("Real orchestrator + REAL signed HTTP adapter -> MOCK CRM endpoint (simulated; NO real CRM, NO network)")
  console.log("Everything is in-memory: no database, no secrets, no external system is contacted.")
  console.log("=".repeat(88))

  console.log("\n[1] malformed submission is rejected (nothing is created)")
  const rejected = await runs.handleInboundLead(SPAM, CONTEXT, deps)
  line("outcome", rejected.outcome)
  line("errors", rejected.errors.join(" / "))
  line("runs written", String(supabase.tables.workflow_runs.length))

  console.log("\n[2] warm lead -> delivered immediately to the CRM webhook")
  const warm = await runs.handleInboundLead(WARM, CONTEXT, deps)
  line("outcome", warm.outcome)
  line("provider ref", warm.providerRef ?? "-")
  showRun(supabase, warm.runId)

  console.log("\n[3] duplicate resubmission -> idempotent (no second run, no second delivery)")
  const dupe = await runs.handleInboundLead(WARM, CONTEXT, deps)
  line("outcome", dupe.outcome)
  line("same run id", String(dupe.runId === warm.runId))
  line("runs total", String(supabase.tables.workflow_runs.length))

  console.log("\n[4] hot lead -> HELD at the human approval gate (not contacted yet)")
  const hot = await runs.handleInboundLead(HOT, CONTEXT, deps)
  line("outcome", hot.outcome)
  line("deliveries so far", String(crmRequests.length))
  showRun(supabase, hot.runId)

  console.log("\n[5] owner approves the hot lead -> approved delivery runs exactly once")
  const approved = await runs.decideLeadApproval(hot.runId, "approved", CONTEXT, deps)
  line("outcome", approved.outcome)
  line("provider ref", approved.providerRef ?? "-")
  showRun(supabase, hot.runId)

  console.log("\n[6] a second approval on the same run is refused (no double contact)")
  const again = await runs.decideLeadApproval(hot.runId, "approved", CONTEXT, deps)
  line("outcome", again.outcome)

  console.log("\n[7] flaky CRM (503, 503, 200) -> adapter retries and succeeds")
  const flaky = await runs.handleInboundLead(FLAKY, CONTEXT, deps)
  line("outcome", flaky.outcome)
  line("attempts for this lead", String(crmAttempts[FLAKY.email]))
  showRun(supabase, flaky.runId)

  console.log("\n[8] CRM persistently down (500) -> retries exhausted -> run FAILED, no fake success")
  const down = await runs.handleInboundLead(DOWN, CONTEXT, deps)
  line("outcome", down.outcome)
  line("attempts for this lead", String(crmAttempts[DOWN.email]))
  showRun(supabase, down.runId)

  console.log("\n[9] CRM hangs -> bounded by timeout, retried, then FAILED")
  const hang = await runs.handleInboundLead(HANG, CONTEXT, deps)
  line("outcome", hang.outcome)
  line("attempts for this lead", String(crmAttempts[HANG.email]))
  showRun(supabase, hang.runId)

  // ── Delivery report (what an operator / client would read)
  console.log("\n" + "=".repeat(88))
  console.log("DELIVERY REPORT")
  console.log("-".repeat(88))
  console.log("  run            tier   status      result")
  for (const run of supabase.tables.workflow_runs) {
    const tier = run.input.qualification.tier
    const detail = run.error_code ? `${run.error_code}: ${run.error_message}` : `delivered (${run.status})`
    console.log(`  ${run.id.padEnd(15)}${tier.padEnd(7)}${run.status.padEnd(12)}${detail}`)
  }

  const delivered = supabase.tables.workflow_runs.filter((r) => r.status === "succeeded").length
  const failed = supabase.tables.workflow_runs.filter((r) => r.status === "failed").length
  const held = supabase.tables.workflow_runs.filter((r) => r.status === "queued" && r.approval_state === "pending").length
  console.log("-".repeat(88))
  console.log(`  runs: ${supabase.tables.workflow_runs.length} · delivered: ${delivered} · failed: ${failed} · held: ${held} · crm requests: ${crmRequests.length}`)

  // Prove the request was signed and idempotently keyed (first request).
  const first = crmRequests[0]
  if (first) {
    console.log("\n  sampled outbound request (first delivery attempt)")
    line("url", first.url)
    line("signature", first.headers["x-replyflow-signature"])
    line("idempotency-key", first.headers["idempotency-key"])
    line("body leaks the secret?", String(String(first.body).includes("demo-crm-shared-secret")))
  }

  console.log("\nAll state lived in-memory. Nothing was persisted and no external system was contacted.\n")
}

main().catch((error) => {
  console.error("Demo failed:", error instanceof Error ? error.message : error)
  process.exitCode = 1
})
