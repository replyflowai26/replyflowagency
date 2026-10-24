import assert from "node:assert/strict"
import test from "node:test"
import {
  findWorkflowTemplate,
  isCronExpression,
  isPlanReadyForRuntime,
  isSafeCredentialRef,
  isTimezone,
  listWorkflowTemplateIds,
  planWorkflowInstantiation,
  validateTemplateCatalog,
  validateWorkflowTemplate,
  WORKFLOW_TEMPLATES,
} from "../src/lib/workflows/index.js"

const validClientId = "7b9e9d4e-6a5c-4f3e-9d2a-1b2c3d4e5f60"

//
// The workflow template library is definition-only: templates describe triggers,
// steps and integrations but never execute. These tests lock in (a) catalog
// integrity, (b) strict structural validation, (c) reference-only credential
// safety, and (d) the "plan, never execute" instantiation contract.
//

test("catalog contains six valid, uniquely-identified templates", () => {
  assert.equal(WORKFLOW_TEMPLATES.length, 6)
  const result = validateTemplateCatalog(WORKFLOW_TEMPLATES)
  assert.equal(result.ok, true, result.ok ? undefined : result.error)
  const ids = WORKFLOW_TEMPLATES.map((template) => template.id)
  assert.equal(new Set(ids).size, ids.length)
})

test("catalog covers each category exactly once", () => {
  const categories = WORKFLOW_TEMPLATES.map((template) => template.category).sort()
  assert.deepEqual(categories, [
    "booking",
    "crm-sync",
    "follow-up",
    "lead-capture",
    "reporting",
    "support-routing",
  ])
})

test("every catalog template declares at least one step and only references real steps from gates", () => {
  for (const template of WORKFLOW_TEMPLATES) {
    assert.ok(template.steps.length > 0, `${template.id} has no steps`)
    const stepIds = new Set(template.steps.map((step) => step.id))
    for (const gate of template.approvalGates) {
      assert.ok(stepIds.has(gate.stepId), `${template.id}: gate ${gate.id} references ${gate.stepId}`)
    }
  }
})

test("lookup helpers resolve catalog templates", () => {
  assert.equal(findWorkflowTemplate("weekly-reporting")?.category, "reporting")
  assert.equal(findWorkflowTemplate("does-not-exist"), undefined)
  assert.deepEqual(listWorkflowTemplateIds().length, 6)
})

test("validateWorkflowTemplate accepts every catalog entry", () => {
  for (const template of WORKFLOW_TEMPLATES) {
    const result = validateWorkflowTemplate(template)
    assert.equal(result.ok, true, result.ok ? undefined : `${template.id}: ${result.error}`)
  }
})

test("validateWorkflowTemplate rejects structurally invalid templates", () => {
  const base = WORKFLOW_TEMPLATES[0]
  const cases: Array<{ label: string; candidate: unknown }> = [
    { label: "not an object", candidate: null },
    { label: "bad id", candidate: { ...base, id: "Not A Slug" } },
    { label: "bad category", candidate: { ...base, category: "unknown" } },
    { label: "bad version", candidate: { ...base, version: "v1" } },
    { label: "bad status", candidate: { ...base, status: "live" } },
    { label: "no steps", candidate: { ...base, steps: [] } },
    { label: "missing n8n", candidate: { ...base, n8n: undefined } },
  ]
  for (const { label, candidate } of cases) {
    const result = validateWorkflowTemplate(candidate)
    assert.equal(result.ok, false, `expected rejection for ${label}`)
  }
})

test("validateWorkflowTemplate enforces schedule trigger config", () => {
  const scheduled = findWorkflowTemplate("weekly-reporting")
  assert.ok(scheduled)
  const badCron = validateWorkflowTemplate({
    ...scheduled,
    trigger: { type: "schedule", cron: "not a cron", timezone: "UTC" },
  })
  assert.equal(badCron.ok, false)
  const badTz = validateWorkflowTemplate({
    ...scheduled,
    trigger: { type: "schedule", cron: "0 8 * * 1", timezone: "Mars/Olympus" },
  })
  assert.equal(badTz.ok, false)
  const badEvent = validateWorkflowTemplate({
    ...scheduled,
    trigger: { type: "system", event: "Bad Event!" },
  })
  assert.equal(badEvent.ok, false)
})

test("validateWorkflowTemplate rejects duplicate step ids and unknown gate steps", () => {
  const base = WORKFLOW_TEMPLATES[0]
  const dup = validateWorkflowTemplate({
    ...base,
    steps: [base.steps[0], base.steps[0]],
  })
  assert.equal(dup.ok, false)
  if (!dup.ok) assert.match(dup.error, /duplicate id/i)

  const badGate = validateWorkflowTemplate({
    ...base,
    approvalGates: [{ id: "gate-x", stepId: "missing-step", role: "owner", reason: "x" }],
  })
  assert.equal(badGate.ok, false)
  if (!badGate.ok) assert.match(badGate.error, /does not match any step/i)
})

test("validateWorkflowTemplate rejects a raw credential and unprepared webhook path", () => {
  const base = WORKFLOW_TEMPLATES[0]
  const raw = validateWorkflowTemplate({
    ...base,
    requiredIntegrations: [
      { provider: "crm", credentialRef: "sk_live_1234567890", optional: false },
    ],
  })
  assert.equal(raw.ok, false)
  if (!raw.ok) assert.match(raw.error, /reference/i)

  const schemePath = validateWorkflowTemplate({
    ...base,
    trigger: { type: "webhook", pathHint: "https://evil.example/hook" },
  })
  assert.equal(schemePath.ok, false)
})

test("credential references must carry a supported scheme", () => {
  for (const ref of ["vault:integrations/crm", "env:N8N_API_KEY", "integration:msg-1"]) {
    assert.equal(isSafeCredentialRef(ref), true, `expected ${ref} to be valid`)
  }
  for (const ref of [
    "sk_live_1234567890",
    "AKIAIOSFODNN7EXAMPLE",
    "Bearer abcdef",
    "plaintext-secret",
    "https://vault.example/secret",
  ]) {
    assert.equal(isSafeCredentialRef(ref), false, `expected ${ref} to be rejected`)
  }
})

test("cron and timezone helpers match supported formats", () => {
  assert.equal(isCronExpression("0 9 * * 1-5"), true)
  assert.equal(isCronExpression("*/15 0 * * *"), true)
  assert.equal(isCronExpression("0 9 * *"), false)
  assert.equal(isTimezone("UTC"), true)
  assert.equal(isTimezone("America/New_York"), true)
  assert.equal(isTimezone("Mars/Olympus"), false)
})

test("planWorkflowInstantiation builds an execution-free plan", () => {
  const template = findWorkflowTemplate("lead-capture-qualification")
  assert.ok(template)
  const result = planWorkflowInstantiation(template, { clientId: validClientId })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.plan.executable, false)
    assert.equal(result.plan.triggerType, "webhook")
    assert.equal(result.plan.clientId, validClientId)
    assert.equal(result.plan.n8n.workflowId, null)
    assert.equal(result.plan.n8n.webhookPath, null)
    assert.equal(result.plan.workflow.status, "draft")
    assert.ok(result.plan.warnings.some((warning) => /n8n workflow id/i.test(warning)))
    assert.ok(result.plan.warnings.some((warning) => /unverified/i.test(warning)))
  }
})

test("planWorkflowInstantiation reports missing required integrations", () => {
  const template = findWorkflowTemplate("lead-capture-qualification")
  assert.ok(template)
  const missing = planWorkflowInstantiation(template, { clientId: null }, { availableProviders: [] })
  assert.equal(missing.ok, true)
  if (missing.ok) {
    assert.deepEqual(missing.plan.missingIntegrations, ["crm"])
    assert.equal(isPlanReadyForRuntime(missing.plan), false)
  }

  const ready = planWorkflowInstantiation(template, { clientId: null }, { availableProviders: ["crm"] })
  assert.equal(ready.ok, true)
  if (ready.ok) {
    assert.deepEqual(ready.plan.missingIntegrations, [])
    assert.equal(isPlanReadyForRuntime(ready.plan), true)
  }
})

test("planWorkflowInstantiation rejects invalid client ids and overrides", () => {
  const template = findWorkflowTemplate("follow-up-sequence")
  assert.ok(template)
  const badClient = planWorkflowInstantiation(template, { clientId: "not-a-uuid" })
  assert.equal(badClient.ok, false)

  const badName = planWorkflowInstantiation(template, { clientId: null, nameOverride: "x" })
  assert.equal(badName.ok, false)
})

test("planWorkflowInstantiation warns about unknown input default keys", () => {
  const template = findWorkflowTemplate("follow-up-sequence")
  assert.ok(template)
  const result = planWorkflowInstantiation(template, {
    clientId: null,
    inputDefaults: { lookback_days: 7, not_a_field: true },
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.ok(result.plan.warnings.some((warning) => /not_a_field/.test(warning)))
  }
})

test("planWorkflowInstantiation rejects malformed templates without throwing", () => {
  const result = planWorkflowInstantiation({ id: "broken" }, { clientId: null })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /Invalid template/i)
})
