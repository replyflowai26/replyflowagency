/**
 * Real AI model adapter tests.
 *
 * These exercise the OPT-IN OpenAI-compatible adapter with ZERO network calls:
 * every test injects a fake `fetchFn` and a no-op `sleep`. Nothing here touches
 * a real provider, and no secret is ever a real value.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPlanMessages,
  createOpenAiCompatibleModelAdapter,
  normalizeBaseUrl,
  parseAiModelConfig,
  parseModelPlan,
  resolveAgentModelAdapter,
  AI_API_KEY_ENV,
  AI_BASE_URL_ENV,
  AI_MODEL_ENV,
  DEFAULT_AI_MAX_RETRIES,
  type AiModelConfig,
} from "../src/lib/agents/model-provider-openai"
import { validateObjective } from "../src/lib/agents/planner-core"
import type { AgentPlan } from "../src/lib/agents/types"

const KEY = "test-secret-key-do-not-log"
const BASE = "https://llm.example.test/v1"
const MODEL = "test-model-1"

type FetchCall = { url: string; init: RequestInit }

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

function chatBody(content: string): unknown {
  return { choices: [{ message: { content } }] }
}

function makeConfig(over: Partial<AiModelConfig> = {}): AiModelConfig {
  return {
    apiKey: KEY,
    baseUrl: BASE,
    model: MODEL,
    timeoutMs: 1000,
    maxRetries: 0,
    sleep: async () => {},
    ...over,
  }
}

// ─── Configuration parsing ───────────────────────────────────────────────────

test("parseAiModelConfig reports each missing variable without leaking secrets", () => {
  const missingKey = parseAiModelConfig({ [AI_BASE_URL_ENV]: BASE, [AI_MODEL_ENV]: MODEL })
  assert.equal(missingKey.ok, false)
  assert.match((missingKey as { reason: string }).reason, /REPLYFLOW_AI_API_KEY/)

  const missingUrl = parseAiModelConfig({ [AI_API_KEY_ENV]: KEY, [AI_MODEL_ENV]: MODEL })
  assert.equal(missingUrl.ok, false)
  assert.match((missingUrl as { reason: string }).reason, /REPLYFLOW_AI_BASE_URL/)

  const missingModel = parseAiModelConfig({ [AI_API_KEY_ENV]: KEY, [AI_BASE_URL_ENV]: BASE })
  assert.equal(missingModel.ok, false)
  assert.match((missingModel as { reason: string }).reason, /REPLYFLOW_AI_MODEL/)
})

test("parseAiModelConfig accepts a valid configuration and normalises it", () => {
  const result = parseAiModelConfig({
    [AI_API_KEY_ENV]: KEY,
    [AI_BASE_URL_ENV]: "https://llm.example.test/v1///",
    [AI_MODEL_ENV]: MODEL,
  })
  assert.equal(result.ok, true)
  const config = (result as { ok: true; config: AiModelConfig }).config
  assert.equal(config.baseUrl, "https://llm.example.test/v1")
  assert.equal(config.model, MODEL)
  assert.equal(config.maxRetries, DEFAULT_AI_MAX_RETRIES)
})

test("normalizeBaseUrl requires https, allows loopback http and rejects credentials", () => {
  assert.equal(normalizeBaseUrl("https://host.test/v1"), "https://host.test/v1")
  assert.equal(normalizeBaseUrl("http://localhost:11434/v1"), "http://localhost:11434/v1")
  assert.equal(normalizeBaseUrl("http://127.0.0.1:8000"), "http://127.0.0.1:8000")
  assert.equal(normalizeBaseUrl("http://evil.example.test"), null)
  assert.equal(normalizeBaseUrl("https://user:pass@host.test"), null)
  assert.equal(normalizeBaseUrl("not-a-url"), null)
})

// ─── Untrusted plan parsing ──────────────────────────────────────────────────

test("parseModelPlan keeps only allowlisted tools and derives consequential", () => {
  const parsed = parseModelPlan(
    {
      category: "outreach",
      steps: [
        { id: "attacker-1", tool: "external.message.send", description: "send it" },
        { id: "attacker-2", tool: "internal.content.draft", description: "draft it" },
        { id: "attacker-3", tool: "shell.exec", description: "run arbitrary code" },
      ],
    },
    "Email the leads",
  )
  assert.equal(parsed.ok, true)
  const plan = (parsed as { ok: true; plan: AgentPlan }).plan
  assert.deepEqual(
    plan.steps.map((s) => s.tool),
    ["external.message.send", "internal.content.draft"],
  )
  // Our own ids, not the model's.
  assert.deepEqual(
    plan.steps.map((s) => s.id),
    ["step-1", "step-2"],
  )
  assert.equal(plan.steps[0].consequential, true)
  assert.equal(plan.steps[1].consequential, false)
  assert.equal(plan.requiresApproval, true)
  assert.equal(plan.deterministic, false)
  assert.ok(plan.warnings.some((w) => w.includes("dropped")))
})

test("parseModelPlan strips code fences and coerces an unknown category to general", () => {
  const parsed = parseModelPlan(
    '```json\n{"category":"nonsense","summary":"x","steps":[{"tool":"internal.report.compose","description":"compose"}]}\n```',
    "do something",
  )
  assert.equal(parsed.ok, true)
  const plan = (parsed as { ok: true; plan: AgentPlan }).plan
  assert.equal(plan.category, "general")
  assert.equal(plan.requiresApproval, false)
})

test("parseModelPlan rejects invalid, empty and unusable answers", () => {
  assert.equal(parseModelPlan("not json", "x").ok, false)
  assert.equal(parseModelPlan({ steps: [] }, "x").ok, false)
  assert.equal(
    parseModelPlan({ steps: [{ tool: "totally.made.up" }] }, "x").ok,
    false,
  )
})

// ─── HTTP adapter behaviour (no network) ─────────────────────────────────────

test("adapter sends a correct request and never puts the key in the body", async () => {
  const calls: FetchCall[] = []
  let seenBody = ""
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    seenBody = String(init.body)
    return fakeResponse(200, chatBody(JSON.stringify({ category: "reporting", steps: [{ tool: "internal.report.compose", description: "compose" }] })))
  }) as unknown as typeof fetch

  const adapter = createOpenAiCompatibleModelAdapter(makeConfig({ fetchFn }))
  assert.equal(adapter.isDeterministic, false)
  assert.equal(adapter.ref, `openai-compatible:${MODEL}`)

  const result = await adapter.plan({ objective: "Write the weekly report" })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.modelRef, `openai-compatible:${MODEL}`)
    assert.equal(result.plan.steps[0].tool, "internal.report.compose")
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, `${BASE}/chat/completions`)
  assert.equal(calls[0].init.method, "POST")
  const headers = calls[0].init.headers as Record<string, string>
  assert.equal(headers.authorization, `Bearer ${KEY}`)
  // The secret must never appear in the prompt/body.
  assert.ok(!seenBody.includes(KEY))
})

test("adapter does NOT retry a 4xx and reports a safe error", async () => {
  let count = 0
  const fetchFn = (async () => {
    count += 1
    return fakeResponse(401, { error: "nope" })
  }) as unknown as typeof fetch

  const adapter = createOpenAiCompatibleModelAdapter(makeConfig({ fetchFn, maxRetries: 3 }))
  const result = await adapter.plan({ objective: "Write the weekly report" })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "model_error")
  assert.equal(count, 1)
})

test("adapter retries 5xx then succeeds", async () => {
  let count = 0
  const fetchFn = (async () => {
    count += 1
    if (count < 3) return fakeResponse(503, {})
    return fakeResponse(200, chatBody(JSON.stringify({ steps: [{ tool: "internal.knowledge.search" }] })))
  }) as unknown as typeof fetch

  const adapter = createOpenAiCompatibleModelAdapter(makeConfig({ fetchFn, maxRetries: 3 }))
  const result = await adapter.plan({ objective: "Research competitors" })
  assert.equal(result.ok, true)
  assert.equal(count, 3)
})

test("adapter exhausts retries on persistent 5xx and never fakes success", async () => {
  let count = 0
  const fetchFn = (async () => {
    count += 1
    return fakeResponse(500, {})
  }) as unknown as typeof fetch

  const adapter = createOpenAiCompatibleModelAdapter(makeConfig({ fetchFn, maxRetries: 2 }))
  const result = await adapter.plan({ objective: "Research competitors" })
  assert.equal(result.ok, false)
  assert.equal(count, 3)
})

test("adapter retries network errors", async () => {
  let count = 0
  const fetchFn = (async () => {
    count += 1
    throw new Error("socket hang up")
  }) as unknown as typeof fetch

  const adapter = createOpenAiCompatibleModelAdapter(makeConfig({ fetchFn, maxRetries: 1 }))
  const result = await adapter.plan({ objective: "Research competitors" })
  assert.equal(result.ok, false)
  assert.equal(count, 2)
})

test("adapter times out a hung attempt via AbortController", async () => {
  const fetchFn = ((_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
      })
    })) as unknown as typeof fetch

  const adapter = createOpenAiCompatibleModelAdapter(
    makeConfig({ fetchFn, maxRetries: 0, timeoutMs: 1000 }),
  )
  const result = await adapter.plan({ objective: "Research competitors" })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "model_error")
})

test("adapter reports a malformed response body as invalid", async () => {
  const fetchFn = (async () => fakeResponse(200, { choices: [] })) as unknown as typeof fetch
  const adapter = createOpenAiCompatibleModelAdapter(makeConfig({ fetchFn }))
  const result = await adapter.plan({ objective: "Research competitors" })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "invalid")
})

// ─── Prompt safety ───────────────────────────────────────────────────────────

test("buildPlanMessages never contains a secret and includes the allowlist", () => {
  const messages = buildPlanMessages("Email the new leads")
  const joined = messages.map((m) => m.content).join("\n")
  assert.ok(!joined.includes(KEY))
  assert.ok(joined.includes("external.message.send"))
  assert.ok(!joined.includes("shell.exec"))
})

// ─── Selection ───────────────────────────────────────────────────────────────

test("resolveAgentModelAdapter defaults to deterministic with no configuration", async () => {
  const adapter = resolveAgentModelAdapter({})
  assert.equal(adapter.isDeterministic, true)
  assert.equal(adapter.ref, "deterministic-planner-v1")
  const result = await adapter.plan({ objective: "Write the weekly report" })
  assert.equal(result.ok, true)
})

test("resolveAgentModelAdapter fails honestly on partial configuration", async () => {
  const adapter = resolveAgentModelAdapter({ [AI_API_KEY_ENV]: KEY })
  assert.equal(adapter.isDeterministic, false)
  const result = await adapter.plan({ objective: "Write the weekly report" })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "unavailable")
})

test("resolveAgentModelAdapter selects the real adapter when fully configured", async () => {
  let called = false
  const fetchFn = (async () => {
    called = true
    return fakeResponse(200, chatBody(JSON.stringify({ steps: [{ tool: "internal.report.compose" }] })))
  }) as unknown as typeof fetch

  const adapter = resolveAgentModelAdapter(
    { [AI_API_KEY_ENV]: KEY, [AI_BASE_URL_ENV]: BASE, [AI_MODEL_ENV]: MODEL },
    { fetchFn, sleep: async () => {} },
  )
  assert.equal(adapter.isDeterministic, false)
  assert.equal(adapter.ref, `openai-compatible:${MODEL}`)
  // Merely constructing it must not perform I/O.
  assert.equal(called, false)
  const result = await adapter.plan({ objective: "Write the weekly report" })
  assert.equal(result.ok, true)
  assert.equal(called, true)
})

test("resolveAgentModelAdapter refuses an insecure base URL", () => {
  const adapter = resolveAgentModelAdapter({
    [AI_API_KEY_ENV]: KEY,
    [AI_BASE_URL_ENV]: "http://evil.example.test",
    [AI_MODEL_ENV]: MODEL,
  })
  assert.equal(adapter.isDeterministic, false)
})

// ─── Sanity: objective validation still gates the adapter ────────────────────

test("adapter rejects an invalid objective before any call", async () => {
  let called = false
  const fetchFn = (async () => {
    called = true
    return fakeResponse(200, chatBody("{}"))
  }) as unknown as typeof fetch
  const adapter = createOpenAiCompatibleModelAdapter(makeConfig({ fetchFn }))
  const result = await adapter.plan({ objective: "short" })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "invalid")
  assert.equal(called, false)
  assert.equal(validateObjective("short").ok, false)
})
