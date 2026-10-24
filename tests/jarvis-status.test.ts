import assert from "node:assert/strict"
import test from "node:test"

import { getJarvisRuntimeSummary, JARVIS_PLANNER_DETERMINISTIC_REF } from "../src/lib/agents/jarvis-status"
import { AGENT_TOOL_IDS } from "../src/lib/agents/tools"

test("with no AI configuration the deterministic planner is available", () => {
  const summary = getJarvisRuntimeSummary({}, { runtimeTablesProvisioned: true })
  const planner = summary.capabilities.find((capability) => capability.id === "planner")
  assert.ok(planner)
  assert.equal(planner.state, "available")
  assert.equal(summary.plannerRef, JARVIS_PLANNER_DETERMINISTIC_REF)
})

test("external actions are honestly reported as unconfigured by default", () => {
  const summary = getJarvisRuntimeSummary({}, { runtimeTablesProvisioned: true })
  assert.equal(summary.externalActionsConfigured, false)
  const external = summary.capabilities.find((capability) => capability.id === "external-actions")
  assert.ok(external)
  assert.equal(external.state, "optional-unconfigured")
})

test("missing runtime tables are reported as not provisioned", () => {
  const summary = getJarvisRuntimeSummary({}, { runtimeTablesProvisioned: false })
  const tables = summary.capabilities.find((capability) => capability.id === "runtime-tables")
  assert.ok(tables)
  assert.equal(tables.state, "not-provisioned")
})

test("a null probe result is reported as not provisioned, never as available", () => {
  const summary = getJarvisRuntimeSummary({}, { runtimeTablesProvisioned: null })
  const tables = summary.capabilities.find((capability) => capability.id === "runtime-tables")
  assert.ok(tables)
  assert.equal(tables.state, "not-provisioned")
})

test("complete AI configuration is reported as available without leaking values", () => {
  const env = {
    REPLYFLOW_AI_API_KEY: "sk-super-secret-value",
    REPLYFLOW_AI_BASE_URL: "https://api.example.com/v1",
    REPLYFLOW_AI_MODEL: "test-model",
  }
  const summary = getJarvisRuntimeSummary(env, { runtimeTablesProvisioned: true })
  const planner = summary.capabilities.find((capability) => capability.id === "planner")
  assert.ok(planner)
  assert.equal(planner.state, "available")
  for (const capability of summary.capabilities) {
    assert.ok(!capability.detail.includes("sk-super-secret-value"), "capability detail must not contain the API key")
    assert.ok(!capability.detail.includes("test-model"), "capability detail must not contain the model name")
  }
})

test("partial AI configuration is flagged as needing attention", () => {
  const env = { REPLYFLOW_AI_API_KEY: "sk-half-configured" }
  const summary = getJarvisRuntimeSummary(env, { runtimeTablesProvisioned: true })
  const planner = summary.capabilities.find((capability) => capability.id === "planner")
  assert.ok(planner)
  assert.equal(planner.state, "optional-misconfigured")
  assert.ok(!planner.detail.includes("sk-half-configured"))
})

test("the tool summary covers every allowlisted tool and marks consequential ones", () => {
  const summary = getJarvisRuntimeSummary({}, { runtimeTablesProvisioned: true })
  assert.equal(summary.tools.length, AGENT_TOOL_IDS.length)
  for (const id of AGENT_TOOL_IDS) {
    assert.ok(summary.tools.some((tool) => tool.id === id), `missing tool ${id}`)
  }
  const consequential = summary.tools.filter((tool) => tool.consequential)
  assert.ok(consequential.length >= 1)
  for (const tool of consequential) {
    assert.equal(tool.scope, "consequential")
  }
})

test("autonomy is never claimed as available", () => {
  const summary = getJarvisRuntimeSummary({}, { runtimeTablesProvisioned: true })
  const autonomy = summary.capabilities.find((capability) => capability.id === "autonomy")
  assert.ok(autonomy)
  assert.notEqual(autonomy.state, "available")
})
