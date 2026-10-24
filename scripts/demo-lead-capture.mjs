// Local, self-contained demo of the lead-capture vertical slice.
//
// WHAT THIS SHOWS
//   A raw inbound lead payload travels the REAL orchestration code:
//   validate/normalize → deterministic qualification → durable run "enqueue"
//   (an in-memory Supabase substitute here) → human approval gate → mock CRM
//   delivery → actionable failure. It is the executable definition of the
//   client-facing offer.
//
// WHAT THIS DOES NOT DO (deliberately)
//   - No database, no network, no n8n, no secrets. The Supabase client is an
//     in-memory fake and the integration adapter is an explicit MOCK.
//   - No production module is imported: it only loads the compiled pure modules
//     from .test-dist (run via `npm run demo:lead-capture`).
//
// The same code paths are covered by tests/lead-capture-workflow.test.ts.

import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))
const dist = (p) => resolve(REPO_ROOT, ".test-dist/src/lib", p)

const lead = require(dist("leads/lead-capture.js"))
const runs = require(dist("automation/lead-capture-run.js"))
const adapters = require(dist("automation/integration-adapter.js"))

const ORG = "11111111-1111-4111-8111-111111111111"
const PROJECT = "22222222-2222-4222-8222-222222222222"
const WF = "33333333-3333-4333-8333-333333333333"

const CONTEXT = { organizationId: ORG, projectId: PROJECT, workflowId: WF, clientId: null }

// A tiny in-memory stand-in for the Supabase admin client. It supports only the
// builder calls the orchestrator uses, and records rows so we can print them.
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
        return Promise.resolve().then(() => {
          flush()
          return { data: null, error: null }
        }).then(onFulfilled)
      },
    }
    return chain
  }
  // Emulates public.apply_workflow_run_transition: validate, compare-and-set on
  // the observed status, no-op on terminal, and record the audit event in the
  // same step. This is the atomic path the orchestrator now uses for every
  // state change.
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
function line(label, value) {
  console.log(`  ${label.padEnd(22)} ${value}`)
}

function showRun(supabase, runId) {
  const run = supabase.tables.workflow_runs.find((r) => r.id === runId)
  const events = supabase.tables.workflow_run_events.filter((e) => e.run_id === runId)
  console.log(`\n  run ${runId}`)
  line("status", run.status)
  line("trigger_type", run.trigger_type)
  line("idempotency_key", run.idempotency_key)
  line("tier / score", `${run.input.qualification.tier} / ${run.input.qualification.score}`)
  line("event timeline", events.map((e) => e.event_type).join("  →  "))
  return run
}

const WARM_LEAD = { name: "Sam Prospect", email: "sam@brightlabs.io", source: "website" }
const HOT_LEAD = {
  name: "Dana Buyer",
  email: "dana@acme-industrial.com",
  phone: "+1 (415) 555-0134",
  company: "Acme Industrial",
  message: "We need to automate inbound lead handling across three regional sales teams.",
  source: "referral",
}
const SPAM = { name: "x", email: "not-an-email" }

async function main() {
  const supabase = createFakeSupabase()
  const notify = adapters.createMockNotificationAdapter({ providerRef: "mock://crm/created/42" })
  const deps = {
    supabase,
    notify,
    newId: supabase.nextId,
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  }

  console.log("\nReplyFlow AI · lead-capture workflow (local demo, MOCK integration, no DB/network)")
  console.log("=".repeat(84))

  console.log("\n[1] malformed submission")
  const rejected = await runs.handleInboundLead(SPAM, CONTEXT, deps)
  line("outcome", rejected.outcome)
  line("errors", rejected.errors.join(" / "))
  line("rows written", String(supabase.tables.workflow_runs.length))

  console.log("\n[2] valid warm lead → auto-delivered to CRM (mock)")
  const warm = await runs.handleInboundLead(WARM_LEAD, CONTEXT, deps)
  line("outcome", warm.outcome)
  line("qualification", `${warm.qualification?.tier} (${warm.qualification?.score})`)
  line("mock deliveries", String(notify.calls.length))
  showRun(supabase, warm.runId)

  console.log("\n[3] duplicate resubmission of the SAME lead")
  const dupe = await runs.handleInboundLead(WARM_LEAD, CONTEXT, deps)
  line("outcome", dupe.outcome)
  line("same run id", String(dupe.runId === warm.runId))
  line("runs total", String(supabase.tables.workflow_runs.length))

  console.log("\n[4] hot lead → held at the human approval gate (NOT delivered)")
  const hot = await runs.handleInboundLead(HOT_LEAD, CONTEXT, deps)
  line("outcome", hot.outcome)
  line("deliveries still", String(notify.calls.length))
  showRun(supabase, hot.runId)

  console.log("\n[5] owner approves the hot lead → consequential delivery runs")
  const approved = await runs.decideLeadApproval(hot.runId, "approved", CONTEXT, deps)
  line("outcome", approved.outcome)
  line("mock deliveries", String(notify.calls.length))
  showRun(supabase, hot.runId)

  console.log("\n[6] a second decision on the same run is refused (no double action)")
  const again = await runs.decideLeadApproval(hot.runId, "approved", CONTEXT, deps)
  line("outcome", again.outcome)

  console.log("\n" + "=".repeat(84))
  console.log(`runs: ${supabase.tables.workflow_runs.length} · events: ${supabase.tables.workflow_run_events.length} · mock deliveries: ${notify.calls.length}`)
  console.log("All state lived in-memory. Nothing was persisted and no external system was contacted.\n")
}

main().catch((error) => {
  console.error("Demo failed:", error instanceof Error ? error.message : error)
  process.exitCode = 1
})
