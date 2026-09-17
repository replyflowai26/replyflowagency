import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  canTransitionRun,
  isTerminalRunStatus,
  isWorkflowRunStatus,
  WORKFLOW_RUN_STATUSES,
} from "../src/lib/automation/run-state-machine.js"
import { buildN8nWebhookUrl, isSafeN8nWebhookPath } from "../src/lib/automation/webhook.js"
import {
  parseCallbackPayload,
  verifyCallbackSignature,
  signCallbackPayload,
  callbackFingerprint,
  type CallbackPayload,
} from "../src/lib/automation/callback-core.js"

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8")
}

//
// Run state machine
//

test("state machine allows only legal forward transitions", () => {
  assert.ok(canTransitionRun("queued", "running"))
  assert.ok(canTransitionRun("queued", "cancelled"))
  assert.ok(canTransitionRun("queued", "failed"))
  assert.ok(canTransitionRun("running", "succeeded"))
  assert.ok(canTransitionRun("running", "failed"))
  assert.ok(canTransitionRun("running", "cancelled"))
})

test("state machine rejects illegal or terminal transitions", () => {
  assert.ok(!canTransitionRun("succeeded", "running"))
  assert.ok(!canTransitionRun("failed", "running"))
  assert.ok(!canTransitionRun("cancelled", "succeeded"))
  assert.ok(!canTransitionRun("succeeded", "failed"))
  assert.ok(!canTransitionRun("running", "queued"))
  assert.ok(!canTransitionRun("queued", "succeeded"))
})

test("terminal statuses are terminal and cannot be exited", () => {
  for (const s of ["succeeded", "failed", "cancelled"] as const) {
    assert.ok(isTerminalRunStatus(s))
    for (const to of WORKFLOW_RUN_STATUSES) {
      assert.ok(!canTransitionRun(s, to))
    }
  }
  assert.ok(!isTerminalRunStatus("queued"))
  assert.ok(!isTerminalRunStatus("running"))
})

test("status validator matches the database check constraint", () => {
  assert.deepEqual([...WORKFLOW_RUN_STATUSES].sort(), [
    "cancelled",
    "failed",
    "queued",
    "running",
    "succeeded",
  ])
  for (const s of WORKFLOW_RUN_STATUSES) assert.ok(isWorkflowRunStatus(s))
  assert.ok(!isWorkflowRunStatus("dispatching"))
  assert.ok(!isWorkflowRunStatus("timed_out"))
  assert.ok(!isWorkflowRunStatus("unknown"))
})

//
// n8n webhook URL builder
//

test("webhook URL builder produces a path-scoped https URL", () => {
  assert.equal(
    buildN8nWebhookUrl("https://n8n.example.com/", "replyflow-abc"),
    "https://n8n.example.com/webhook/replyflow-abc",
  )
  assert.equal(
    buildN8nWebhookUrl("http://localhost:5678", "replyflow-abc"),
    "http://localhost:5678/webhook/replyflow-abc",
  )
})

test("webhook URL builder rejects unsafe or malformed input", () => {
  assert.equal(buildN8nWebhookUrl(undefined as unknown as string, "abc"), null)
  assert.equal(buildN8nWebhookUrl("https://n8n.example.com", null), null)
  assert.equal(buildN8nWebhookUrl("https://n8n.example.com", ""), null)
  assert.equal(buildN8nWebhookUrl("https://n8n.example.com", "../evil"), null)
  assert.equal(buildN8nWebhookUrl("https://n8n.example.com", "a/b"), null)
  assert.equal(buildN8nWebhookUrl("not-a-url", "replyflow-abc"), null)
  assert.ok(!isSafeN8nWebhookPath("../../etc/passwd"))
  assert.ok(!isSafeN8nWebhookPath("a?b"))
  assert.ok(isSafeN8nWebhookPath("replyflow-runtime-abc123"))
})

//
// Callback signature (HMAC)
//

const CB_SECRET = "test-callback-secret"

test("callback signature signs and verifies the exact raw body", () => {
  const body = '{"replyflow_run_id":"00000000-0000-0000-0000-000000000001","status":"success"}'
  const sig = signCallbackPayload(CB_SECRET, body)
  assert.equal(verifyCallbackSignature(CB_SECRET, body, sig), true)
})

test("callback signature rejects tampering, wrong secret, and malformed headers", () => {
  const body = '{"status":"success"}'
  const sig = signCallbackPayload(CB_SECRET, body)

  assert.equal(verifyCallbackSignature(CB_SECRET, body + " ", sig), false)
  assert.equal(verifyCallbackSignature("other-secret", body, sig), false)
  assert.equal(verifyCallbackSignature(CB_SECRET, body, "sha256=zzz"), false)
  assert.equal(verifyCallbackSignature(CB_SECRET, body, null), false)
  assert.equal(verifyCallbackSignature(undefined, body, sig), false)
  assert.equal(verifyCallbackSignature("", body, sig), false)
})

test("callback signature is not length-constant with different secrets", () => {
  assert.notEqual(
    signCallbackPayload(CB_SECRET, "abc"),
    signCallbackPayload("another-secret", "abc"),
  )
})

//
// Callback payload validation
//

const VALID_PAYLOAD: CallbackPayload = {
  replyflow_run_id: "11111111-1111-1111-1111-111111111111",
  organization_id: "22222222-2222-2222-2222-222222222222",
  workflow_id: "33333333-3333-3333-3333-333333333333",
  status: "success",
  execution_id: "42",
  output: { hello: "world" },
  error_message: null,
  error_code: null,
  occurred_at: "2026-09-03T00:00:00Z",
}

test("valid callback payload parses to a typed payload", () => {
  const r = parseCallbackPayload(JSON.parse(JSON.stringify(VALID_PAYLOAD)))
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.payload.replyflow_run_id, VALID_PAYLOAD.replyflow_run_id)
    assert.equal(r.payload.status, "success")
    assert.equal(r.payload.execution_id, "42")
  }
})

test("callback payload rejects malformed or spoofed fields", () => {
  const bad = (overrides: Record<string, unknown>): Record<string, unknown> => ({
    ...VALID_PAYLOAD,
    ...overrides,
  })
  assert.equal(parseCallbackPayload(JSON.parse(JSON.stringify(bad({ replyflow_run_id: "not-a-uuid" })))).ok, false)
  assert.equal(parseCallbackPayload(JSON.parse(JSON.stringify(bad({ organization_id: "bad" })))).ok, false)
  assert.equal(parseCallbackPayload(JSON.parse(JSON.stringify(bad({ workflow_id: "bad" })))).ok, false)
  assert.equal(parseCallbackPayload(JSON.parse(JSON.stringify(bad({ status: "running" })))).ok, false)
  assert.equal(parseCallbackPayload(JSON.parse(JSON.stringify(bad({ execution_id: { nested: true } })))).ok, false)
  assert.equal(parseCallbackPayload(null).ok, false)
  assert.equal(parseCallbackPayload([1, 2]).ok, false)
  assert.equal(parseCallbackPayload("string").ok, false)
})

test("callback fingerprint is stable for an identical run/status and never treats data as secrets", () => {
  const a = callbackFingerprint("s", VALID_PAYLOAD)
  const b = callbackFingerprint("s", VALID_PAYLOAD)
  assert.equal(a, b)
  assert.ok(/^[0-9a-f]{32}$/.test(a))
})

//
// Source-inspection: production-safe dispatch, callback and recovery
//

test("n8n dispatch uses the webhook path and never the internal Execution API", () => {
  const core = readSource("src/lib/automation/n8n-dispatch-core.ts")
  const adapter = readSource("src/lib/automation/n8n.ts")
  const webhook = readSource("src/lib/automation/webhook.ts")
  assert.match(core, /buildN8nWebhookUrl/)
  assert.match(webhook, /\/webhook\//)
  assert.match(core, /POST/)
  assert.doesNotMatch(core, /api\/v1\/executions/)
  assert.doesNotMatch(core, /X-N8N-API-KEY/)
  assert.doesNotMatch(core, /SUPABASE_SERVICE_ROLE_KEY|OPENAI|sk-/)
  assert.doesNotMatch(adapter, /api\/v1\/executions/)
  assert.doesNotMatch(adapter, /X-N8N-API-KEY/)
})

test("dispatch payload carries only run/org/workflow ids and input", () => {
  const src = readSource("src/lib/automation/n8n-dispatch-core.ts")
  assert.match(src, /replyflow_run_id/)
  assert.match(src, /organization_id/)
  assert.match(src, /input/)
  // A successful dispatch must not be treated as workflow success.
  assert.doesNotMatch(src, /externalExecutionId/)
})

test("execution service guards transitions and never marks a run failed on network ambiguity", () => {
  const src = readSource("src/lib/automation/execution-service.ts")
  assert.match(src, /\.eq\("status", "queued"\)/)
  assert.match(src, /already dispatched/)
  assert.match(src, /dispatch_uncertain/)
  assert.match(src, /n8n accepted the webhook/)
  assert.match(src, /n8n_webhook_path/)
  assert.doesNotMatch(src, /status: "succeeded"/)
})

test("callback route authenticates with HMAC and returns safe errors", () => {
  const src = readSource("src/app/api/automation/callback/route.ts")
  assert.match(src, /verifyCallbackSignature/)
  assert.match(src, /x-replyflow-signature/)
  assert.match(src, /status: 401/)
  assert.match(src, /status: 400/)
  assert.match(src, /REPLYFLOW_CALLBACK_SECRET/)
  assert.match(src, /already_terminal/)
})

test("callback apply path is idempotent and tenant-safe", () => {
  const applySrc = readSource("src/lib/automation/callback-apply.ts")
  assert.match(applySrc, /already_terminal/)
  assert.match(applySrc, /canTransitionRun/)
  assert.match(applySrc, /\.eq\("organization_id",/)
  assert.match(applySrc, /workflow_id !==/)
  // The production service must still route through the real admin client and
  // must never substitute an RLS uid() filter for the organization boundary.
  const serviceSrc = readSource("src/lib/automation/callback-service.ts")
  assert.match(serviceSrc, /createAdminClient/)
  assert.doesNotMatch(serviceSrc, /\.eq\("organization_id", .*auth\.uid\(\)/)
})

test("recovery classifies by timeout and never blindly re-dispatches", () => {
  const src = readSource("src/lib/automation/recovery-service.ts")
  assert.match(src, /DISPATCH_TIMEOUT/)
  assert.match(src, /EXECUTION_TIMEOUT/)
  assert.match(src, /terminalize/)
  assert.match(src, /reconcileExecution/)
  // Recovery must never start a new external execution.
  assert.doesNotMatch(src, /dispatchToN8nWebhook/)
})

test("recovery never mutates a run to running from a terminal state", () => {
  const src = readSource("src/lib/automation/recovery-service.ts")
  assert.doesNotMatch(src, /status: "running"/)
})
