import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import {
  classifyN8nWebhookResponse,
  dispatchN8nWebhookRequest,
  isN8nWebhookNotRegisteredBody,
  type N8nDispatchRequest,
} from "../src/lib/automation/n8n-dispatch-core.js"
import { buildN8nWebhookUrl } from "../src/lib/automation/webhook.js"

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8")
}

//
// Regression: "Run now" showed "n8n rejected the dispatch (HTTP 404)". Probe
// evidence: local n8n returns an intentional 404 whose JSON body declares "The
// requested webhook ... is not registered" when the mapped path is a
// placeholder/test value. These tests lock in exact-response classification so
// a 404 that truly means "webhook not registered" is surfaced as a
// configuration error and no other 404/status is ever mislabelled.
//

const BASE = "http://localhost:5678"

const REQUEST: N8nDispatchRequest = {
  workflowId: "7b9e9d4e-6a5c-4f3e-9d2a-1b2c3d4e5f60",
  runId: "11111111-1111-1111-1111-111111111111",
  organizationId: "22222222-2222-2222-2222-222222222222",
  webhookPath: "replyflow-test-lead-capture",
  input: { lead: { email: "probe@example.com" } },
}

const N8N_NOT_REGISTERED_BODY = JSON.stringify({
  code: 404,
  message:
    'The requested webhook "POST replyflow-test-lead-capture" is not registered.',
  hint: "The workflow must be active for a production URL to run successfully.",
})

function fakeResponse(status: number, bodyText: string): Response {
  const text = () => Promise.resolve(bodyText)
  return { status, ok: status >= 200 && status < 300, text } as unknown as Response
}

function fakeFetchReturning(status: number, bodyText = "") {
  return async () => fakeResponse(status, bodyText)
}

function captureFetch() {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl: typeof fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input)
    calls.push({ url, init: init ?? {} })
    return fakeResponse(200, "{}")
  }) as typeof fetch
  return { fetchImpl, calls }
}

test("exact failure: n8n 404 'webhook not registered' classifies as not_registered", async () => {
  const result = await dispatchN8nWebhookRequest(REQUEST, BASE, {
    fetchImpl: fakeFetchReturning(404, N8N_NOT_REGISTERED_BODY),
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.reason, "not_registered")
    assert.equal(result.status, 404)
  }
})

test("n8n 404 'webhook not registered' with test-mode phrasing also classifies as not_registered", async () => {
  const testModeBody = JSON.stringify({
    code: 404,
    message: 'The requested webhook "replyflow-test-lead-capture" is not registered.',
  })
  const result = await dispatchN8nWebhookRequest(REQUEST, BASE, {
    fetchImpl: fakeFetchReturning(404, testModeBody),
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "not_registered")
})

test("HTTP 404 without the n8n signature stays a generic http_error (never mislabelled)", async () => {
  for (const body of [
    "",
    "<html>404 Not Found</html>",
    JSON.stringify({ code: 404, message: "No route matched with those values" }),
    JSON.stringify({ status: 404 }),
  ]) {
    const result = await dispatchN8nWebhookRequest(REQUEST, BASE, {
      fetchImpl: fakeFetchReturning(404, body),
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, "http_error", `expected http_error for body=${JSON.stringify(body)}`)
      assert.equal(result.status, 404)
    }
  }
})

test("signature matcher rejects non-404 bodies and non-registration phrasing", () => {
  assert.equal(isN8nWebhookNotRegisteredBody(N8N_NOT_REGISTERED_BODY), true)
  assert.equal(isN8nWebhookNotRegisteredBody('{"code":500,"message":"boom"}'), false)
  assert.equal(isN8nWebhookNotRegisteredBody('{"code":404,"message":"not found"}'), false)
  assert.equal(isN8nWebhookNotRegisteredBody(undefined), false)
  assert.equal(isN8nWebhookNotRegisteredBody(null), false)
  assert.equal(isN8nWebhookNotRegisteredBody(""), false)
})

test("2xx responses dispatch successfully", async () => {
  for (const status of [200, 201, 202, 204]) {
    const result = await dispatchN8nWebhookRequest(REQUEST, BASE, {
      fetchImpl: fakeFetchReturning(status, '{"message":"Workflow was started"}'),
    })
    assert.equal(result.ok, true, `expected ok for ${status}`)
    if (result.ok) assert.deepEqual(result, { ok: true })
  }
})

test("other HTTP errors (5xx/4xx) are generic http_error with the status preserved", async () => {
  for (const status of [400, 401, 409, 500, 503]) {
    const result = await dispatchN8nWebhookRequest(REQUEST, BASE, {
      fetchImpl: fakeFetchReturning(status, "oops"),
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, "http_error")
      assert.equal(result.status, status)
    }
  }
})

test("transport failures classify as network (ambiguous, never failed)", async () => {
  const failures: unknown[] = [
    Object.assign(new Error("fetch failed"), { code: "ECONNREFUSED" }),
    Object.assign(new Error("fetch failed"), { code: "ENOTFOUND" }),
    Object.assign(new Error("The operation was aborted due to timeout"), { code: "ECONNRESET" }),
    new Error("boom"),
  ]
  for (const err of failures) {
    const result = await dispatchN8nWebhookRequest(REQUEST, BASE, {
      fetchImpl: (async () => {
        throw err
      }) as typeof fetch,
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, "network")
  }
})

test("malformed or absolute webhook paths are rejected before any network call", async () => {
  const hostilePaths = [
    "../../etc/passwd",
    "/replyflow-abc",
    "https://evil.example/webhook/x",
    "//evil.example/webhook/x",
    "replyflow-abc?p=1",
    "replyflow-abc#frag",
    "replyflow abc",
    "",
    "a".repeat(301),
  ]
  for (const webhookPath of hostilePaths) {
    const { fetchImpl, calls } = captureFetch()
    const result = await dispatchN8nWebhookRequest(
      { ...REQUEST, webhookPath },
      BASE,
      { fetchImpl },
    )
    assert.equal(result.ok, false, `expected rejection for path=${JSON.stringify(webhookPath)}`)
    if (!result.ok) assert.equal(result.reason, "invalid_webhook")
    assert.equal(calls.length, 0, `fetch must not be called for path=${JSON.stringify(webhookPath)}`)
  }
})

test("non-http base URLs are rejected (SSRF guard) before any network call", async () => {
  for (const baseUrl of ["ftp://localhost", "file:///etc/passwd", "javascript:alert(1)", "not-a-url", "http://"]) {
    const { fetchImpl, calls } = captureFetch()
    const result = await dispatchN8nWebhookRequest(REQUEST, baseUrl, { fetchImpl })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, "invalid_webhook", `expected invalid_webhook for base=${JSON.stringify(baseUrl)}`)
    assert.equal(calls.length, 0)
  }
})

test("dispatch POSTs the correct base-scoped webhook URL with only run/org/workflow ids and input", async () => {
  const { fetchImpl, calls } = captureFetch()
  const result = await dispatchN8nWebhookRequest(REQUEST, `${BASE}/`, { fetchImpl })
  assert.equal(result.ok, true)
  assert.equal(calls.length, 1)
  const call = calls[0]
  assert.equal(call.url, `${BASE}/webhook/${REQUEST.webhookPath}`)
  assert.equal(call.init.method, "POST")
  const headers = call.init.headers as Record<string, string>
  assert.match(headers["Content-Type"], /application\/json/)
  const body = JSON.parse(String(call.init.body))
  assert.deepEqual(Object.keys(body).sort(), [
    "input",
    "organization_id",
    "replyflow_run_id",
    "workflow_id",
  ])
  assert.equal(body.replyflow_run_id, REQUEST.runId)
  assert.equal(body.organization_id, REQUEST.organizationId)
  assert.equal(body.workflow_id, REQUEST.workflowId)
  assert.deepEqual(body.input, REQUEST.input)
  const serialized = String(call.init.body)
  assert.doesNotMatch(serialized, /api[_-]?key|secret|token|password|service_role/i)
})

test("URL builder yields the same dispatch URL for the real configured base", () => {
  assert.equal(
    buildN8nWebhookUrl("http://localhost:5678", "replyflow-test-lead-capture"),
    "http://localhost:5678/webhook/replyflow-test-lead-capture",
  )
  assert.equal(
    buildN8nWebhookUrl("http://localhost:5678/", "replyflow-test-lead-capture"),
    "http://localhost:5678/webhook/replyflow-test-lead-capture",
  )
})

test("server adapter delegates to the injectable pure core", () => {
  const n8n = readSource("src/lib/automation/n8n.ts")
  assert.match(n8n, /dispatchN8nWebhookRequest/)
  assert.match(n8n, /fetchImpl: fetch/)
  assert.doesNotMatch(n8n, /classifyN8nWebhookResponse/, "classification lives in the pure core only")
})

test("execution service classifies not_registered as DISPATCH_CONFIG_ERROR with an actionable message", () => {
  const executionService = readSource("src/lib/automation/execution-service.ts")
  assert.match(executionService, /dispatch\.reason === "not_registered"/)
  const block = executionService.slice(executionService.indexOf('reason === "not_registered"'))
  assert.match(block, /DISPATCH_CONFIG_ERROR/)
  assert.match(block, /is not registered/)
  assert.match(block, /Activate the workflow in n8n or remap the correct webhook path\./)
  // Generic http_error keeps the established project code untouched.
  assert.match(executionService, /N8N_DISPATCH_REJECTED/)
  // Audit events carry the http status.
  assert.match(executionService, /http_status: dispatch\.status/)
})

test("execution service embeds the n8n workflow id for actionable registration diagnostics", () => {
  const executionService = readSource("src/lib/automation/execution-service.ts")
  assert.match(
    executionService,
    /workflows!workflow_runs_workflow_id_organization_id_fkey\(n8n_webhook_path, n8n_workflow_id\)/,
  )
})