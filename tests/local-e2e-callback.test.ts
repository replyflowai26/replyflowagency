/**
 * Local E2E callback test.
 *
 * Creates test DB state → triggers local n8n webhook → n8n executes →
 * n8n sends signed callback to ReplyFlow → callback updates workflow_runs
 * and inserts workflow_run_events → script verifies the full chain.
 *
 * Finite: runs once and exits. No foreground server.
 *
 * SAFETY GATE: this test INSERTS and DELETES rows in the connected Supabase
 * project, so it must never run against an unconfirmed environment. It refuses
 * to start unless the project is explicitly declared a test target:
 *   - REPLYFLOW_E2E_TARGET must be exactly "test"   (from .env.e2e.local or env)
 *   - REPLYFLOW_E2E_PROJECT_REF must be "localhost" and must match the project
 *     ref embedded in the local Supabase URL the test would write to
 *   - the Supabase URL and the n8n base URL must be localhost/127.0.0.1 only
 * On any mismatch it exits non-zero without creating a client or touching the
 * database. Values are read from .env.e2e.local FIRST (git-ignored, operator
 * managed); .env.local is intentionally NEVER read so hosted values cannot leak
 * into this test. The confirmed test project reference is never printed.
 */
import { createClient } from "@supabase/supabase-js"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

// ─── Load .env.e2e.local (local-only values; never .env.local) ───────────────
function loadE2eEnvFile(): Record<string, string> {
  const file = resolve(process.cwd(), ".env.e2e.local")
  if (!existsSync(file)) {
    console.error("FATAL: .env.e2e.local is required for the local E2E callback test (never .env.local).")
    process.exit(1)
  }
  const raw = readFileSync(file, "utf8")
  const env: Record<string, string> = {}
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx < 1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

const env = loadE2eEnvFile()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const CALLBACK_SECRET = env.REPLYFLOW_CALLBACK_SECRET || process.env.REPLYFLOW_CALLBACK_SECRET
const N8N_BASE = env.N8N_BASE_URL || process.env.N8N_BASE_URL || "http://127.0.0.1:5678"
const N8N_API_KEY = env.N8N_API_KEY || process.env.N8N_API_KEY || ""

// The n8n workflow this test drives. It is referenced here only to read its
// webhook path and to POST the dispatch below. It is deliberately NOT written
// to `workflows.n8n_workflow_id`, because that column is a global one-to-one
// mapping that may already belong to an unrelated pre-existing workflow row.
const N8N_WORKFLOW_ID = "ODCxASjOnuMk8fyW"

if (!SUPABASE_URL || !SERVICE_KEY || !CALLBACK_SECRET) {
  console.error("FATAL: missing env vars in .env.e2e.local")
  process.exit(1)
}

// ─── Environment safety gate ─────────────────────────────────────────────────
const E2E_TARGET = env.REPLYFLOW_E2E_TARGET ?? process.env.REPLYFLOW_E2E_TARGET
const E2E_REF = env.REPLYFLOW_E2E_PROJECT_REF ?? process.env.REPLYFLOW_E2E_PROJECT_REF

const LOCALHOST_URL_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

function projectRefFromUrl(url: string): string {
  const host = url.replace(/^https?:\/\//, "").split("/")[0].split(":")[0]
  return host === "127.0.0.1" ? "localhost" : host
}

function assertSafeTestTarget(): void {
  if (E2E_TARGET !== "test") {
    console.error("BLOCKED: REPLYFLOW_E2E_TARGET must be exactly \"test\" to run the E2E callback test.")
    process.exit(1)
  }
  if (!LOCALHOST_URL_RE.test(SUPABASE_URL!)) {
    console.error("BLOCKED: SUPABASE_URL must target localhost/127.0.0.1 only. Refusing to touch a remote project.")
    process.exit(1)
  }
  if (!LOCALHOST_URL_RE.test(N8N_BASE)) {
    console.error("BLOCKED: N8N_BASE_URL must target localhost/127.0.0.1 only.")
    process.exit(1)
  }
  const configuredRef = projectRefFromUrl(SUPABASE_URL!)
  if (E2E_REF !== "localhost" || configuredRef !== "localhost") {
    console.error(
      "BLOCKED: REPLYFLOW_E2E_PROJECT_REF must be \"localhost\" and match the local Supabase URL. " +
      "Refusing to touch an unconfirmed Supabase project.",
    )
    process.exit(1)
  }
  log("0. E2E TARGET", "confirmed local test project (ref=localhost; key not printed)")
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(label: string, msg: string) {
  console.log(`  ${label.padEnd(28)} ${msg}`)
}

// Cleanup IDs — module-scoped so runCleanup() can access them
let orgId = ""
let projectId = ""
let workflowId = ""
let runId = ""
let userId = "" // real auth.users id for FK compliance

/**
 * Remove exactly the rows this test created, scoped to test-created IDs only.
 * Safe to call when any subset of IDs is still empty (no-op for those).
 * Ordered to respect foreign keys: events → runs → workflows → projects → orgs.
 */
async function runCleanup(): Promise<void> {
  console.log("\n── Cleanup ──")
  if (runId) {
    const { error: purgeErr } = await supabase.rpc("purge_test_run_events", {
      p_run_id: runId,
    })
    if (purgeErr) log("CLEANUP", "event purge: " + purgeErr.message)
    await supabase.from("workflow_run_events").delete().eq("run_id", runId)
    await supabase.from("workflow_runs").delete().eq("id", runId)
  }
  if (workflowId) await supabase.from("workflows").delete().eq("id", workflowId)
  if (projectId) await supabase.from("automation_projects").delete().eq("id", projectId)
  if (orgId) await supabase.from("organizations").delete().eq("id", orgId)
  log("CLEANUP", "test data removed ✓")
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<boolean> {
  console.log("\n═══ ReplyFlow Local E2E Callback Test ═══\n")

  // Must pass BEFORE any client use or database read/write.
  // This exits (process.exit) before any data is created — no cleanup needed.
  assertSafeTestTarget()

  try {
    // ── Step 0: Find a real auth.users id (needed for FK on created_by) ────────
    log("0. LOOKUP AUTH USER", "querying organizations for created_by...")
    const { data: existingOrgs, error: userErr } = await supabase
      .from("organizations")
      .select("created_by")
      .not("created_by", "is", null)
      .limit(1)
    if (userErr || !existingOrgs?.length || !existingOrgs[0].created_by) {
      console.error("FAIL: no existing auth user found for FK:", userErr)
      throw new Error("no existing auth user found for FK")
    }
    userId = existingOrgs[0].created_by as string
    log("0. LOOKUP AUTH USER", `id=${userId}`)

    // ── Step 1: Create test data ──────────────────────────────────────────────
    log("1. CREATE ORG", "inserting...")
    const orgSlug = `e2e-test-${Date.now()}`
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: "E2E Test Org", slug: orgSlug })
      .select("id")
      .single()
    if (orgErr || !org) { console.error("FAIL org:", orgErr); throw new Error("org insert failed") }
    orgId = org.id
    log("1. CREATE ORG", `id=${orgId}`)

    log("2. CREATE PROJECT", "inserting...")
    const { data: project, error: projErr } = await supabase
      .from("automation_projects")
      .insert({
        organization_id: orgId,
        name: "E2E Test Project",
        slug: `e2e-proj-${Date.now()}`,
        created_by: userId,
      })
      .select("id")
      .single()
    if (projErr || !project) { console.error("FAIL project:", projErr); throw new Error("project insert failed") }
    projectId = project.id
    log("2. CREATE PROJECT", `id=${projectId}`)

    // Get the webhook path from the n8n workflow
    log("3. LOOKUP N8N WEBHOOK PATH", "querying n8n...")
    const wfResp = await fetch(`${N8N_BASE}/api/v1/workflows/${N8N_WORKFLOW_ID}`, {
      headers: { "X-N8N-API-KEY": N8N_API_KEY, Accept: "application/json" },
    })
    const wfData = await wfResp.json()
    const webhookNode = wfData.nodes?.find((n: any) => n.type === "n8n-nodes-base.webhook")
    const webhookPath = webhookNode?.parameters?.path
    if (!webhookPath) { console.error("FAIL: no webhook path in n8n workflow"); throw new Error("no n8n webhook path") }
    log("3. LOOKUP N8N WEBHOOK PATH", `path=${webhookPath}`)

    log("4. CREATE WORKFLOW", "inserting...")
    const { data: wf, error: wfErr } = await supabase
      .from("workflows")
      .insert({
        organization_id: orgId,
        project_id: projectId,
        name: "E2E Test Workflow",
        status: "active",
        created_by: userId,
        // Deliberately NOT claimed. `workflows_n8n_workflow_id_idx` is a
        // deliberate global one-to-one mapping (migration
        // 20260816000004_n8n_workflow_mapping.sql), so at most one ReplyFlow
        // workflow may reference a given n8n workflow. The n8n workflow this
        // test drives is a real, shared local workflow that can already be
        // mapped to an unrelated pre-existing workflow row; claiming it here
        // would fail the insert with unique-violation 23505, and reclaiming it
        // by deleting the other row would destroy unrelated local data.
        //
        // NULL is valid: the index is partial ("where n8n_workflow_id is not
        // null"), so any number of unmapped fixture rows may coexist. Nothing in
        // this test depends on the mapping — it triggers n8n directly by
        // webhook path, and the callback path only compares workflow_id for
        // forgery detection. Only execution-service.ts (dispatch) reads this
        // column, and this test never uses it.
        n8n_workflow_id: null,
        // Kept for traceability/debugging; this index is non-unique.
        n8n_webhook_path: webhookPath,
      })
      .select("id")
      .single()
    if (wfErr || !wf) { console.error("FAIL workflow:", wfErr); throw new Error("workflow insert failed") }
    workflowId = wf.id
    log("4. CREATE WORKFLOW", `id=${workflowId}`)

    log("5. CREATE RUN", "inserting running run...")
    const { data: run, error: runErr } = await supabase
      .from("workflow_runs")
      .insert({
        organization_id: orgId,
        workflow_id: workflowId,
        project_id: projectId,
        status: "running",
        trigger_type: "manual",
        input: { test: true, e2e: "local-callback-test" },
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .select("id")
      .single()
    if (runErr || !run) { console.error("FAIL run:", runErr); throw new Error("run insert failed") }
    runId = run.id
    log("5. CREATE RUN", `id=${runId} (status=running)`)

    // ── Step 2: Trigger n8n webhook ───────────────────────────────────────────
    log("6. TRIGGER N8N WEBHOOK", `POST ${N8N_BASE}/webhook/${webhookPath}`)
    const webhookUrl = `${N8N_BASE}/webhook/${webhookPath}`
    const dispatchBody = {
      replyflow_run_id: runId,
      organization_id: orgId,
      workflow_id: workflowId,
      input: { test: true, e2e: "local-callback-test" },
    }

    let webhookStatus = 0
    try {
      const whResp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dispatchBody),
      })
      webhookStatus = whResp.status
      log("6. TRIGGER N8N WEBHOOK", `HTTP ${webhookStatus}`)
    } catch (err: any) {
      log("6. TRIGGER N8N WEBHOOK", `FAILED: ${err.message}`)
      throw new Error(`n8n webhook call failed: ${err.message}`)
    }

    if (webhookStatus !== 200) {
      log("6. TRIGGER N8N WEBHOOK", `UNEXPECTED STATUS — aborting`)
      throw new Error(`n8n webhook returned HTTP ${webhookStatus}`)
    }

    // ── Step 3: Wait for callback ─────────────────────────────────────────────
    log("7. WAIT FOR CALLBACK", "polling workflow_runs for terminal state...")
    let attempts = 0
    const maxAttempts = 15 // 15 seconds max
    let finalStatus = "running"

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1000))
      attempts++

      const { data: checkRun } = await supabase
        .from("workflow_runs")
        .select("status, completed_at, output")
        .eq("id", runId)
        .single()

      if (checkRun && ["succeeded", "failed", "cancelled"].includes(checkRun.status)) {
        finalStatus = checkRun.status
        log("7. WAIT FOR CALLBACK", `terminal after ${attempts}s — status=${finalStatus}`)
        break
      }

      if (attempts === maxAttempts) {
        log("7. WAIT FOR CALLBACK", `TIMEOUT after ${maxAttempts}s — still running`)
      }
    }

    // ── Step 4: Verify database state ─────────────────────────────────────────
    console.log("\n── Verification ──")

    log("8. WORKFLOW_RUN STATUS", finalStatus === "succeeded" ? "PASS ✓" : `FAIL — expected succeeded, got ${finalStatus}`)
    if (finalStatus !== "succeeded") throw new Error("terminal status was not succeeded")

    const { data: finalRun } = await supabase
      .from("workflow_runs")
      .select("completed_at, output, external_execution_id")
      .eq("id", runId)
      .single()

    log("9. COMPLETED_AT", finalRun?.completed_at ? "PASS ✓" : "FAIL — null")
    log("10. OUTPUT", finalRun?.output ? "PASS ✓" : "FAIL — null")
    log("11. EXECUTION_ID", finalRun?.external_execution_id?.startsWith("test-local-") ? "PASS ✓" : `FAIL — ${finalRun?.external_execution_id}`)

    const { data: events, count } = await supabase
      .from("workflow_run_events")
      .select("event_type, message", { count: "exact" })
      .eq("run_id", runId)
      .eq("organization_id", orgId)

    const hasSucceededEvent = events?.some((e) => e.event_type === "run.succeeded")
    log("12. RUN EVENTS", hasSucceededEvent ? `PASS ✓ (${count} events)` : `FAIL — no run.succeeded event (count=${count})`)

    if (events) {
      for (const ev of events) {
        log("    EVENT", `${ev.event_type}: ${ev.message}`)
      }
    }

    const allPass = finalStatus === "succeeded"
      && !!finalRun?.completed_at
      && !!finalRun?.output
      && !!finalRun?.external_execution_id?.startsWith("test-local-")
      && !!hasSucceededEvent

    console.log(allPass
      ? "\n═══ LOCAL E2E: PASS ✓ ═══\n"
      : "\n═══ LOCAL E2E: FAIL ═══\n")

    return allPass
  } finally {
    await runCleanup()
  }
}

main()
  .then((passed) => process.exit(passed ? 0 : 1))
  .catch((err) => {
    console.error("FATAL:", err)
    process.exit(1)
  })
