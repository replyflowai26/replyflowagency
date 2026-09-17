import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { parseWorkflowMappingInput } from "../src/lib/automation/webhook.js"

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8")
}

const actionsSource = readSource("src/app/dashboard/projects/actions.ts")
const pageSource = readSource("src/app/dashboard/projects/[id]/page.tsx")
const runActions = readSource("src/app/dashboard/projects/[id]/run-actions.ts")
const executionService = readSource("src/lib/automation/execution-service.ts")

export const validWorkflowId = "7b9e9d4e-6a5c-4f3e-9d2a-1b2c3d4e5f60"
const validInput = {
  workflowId: validWorkflowId,
  n8nWorkflowId: "ODCxASjOnuMk8fyW",
  n8nWebhookPath: "replyflow-runtime-abc",
}

//
// The webhook mapping fix adds a manual "Map webhook" control so users can
// populate `workflows.n8n_workflow_id` + `workflows.n8n_webhook_path` when the
// automatic wiring (e2e only) has not run. These tests lock in the pure input
// validation rules and the tenant-scoped server action, so malformed or
// cross-workspace mapping updates are impossible.
//

test("parseWorkflowMappingInput accepts valid workflow id, n8n id, and webhook path", () => {
  const result = parseWorkflowMappingInput(validInput)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.workflowId, validInput.workflowId)
    assert.equal(result.value.n8nWorkflowId, validInput.n8nWorkflowId)
    assert.equal(result.value.n8nWebhookPath, validInput.n8nWebhookPath)
  }
})

test("parseWorkflowMappingInput accepts leading/trailing whitespace by trimming", () => {
  const result = parseWorkflowMappingInput({
    workflowId: `  ${validWorkflowId}  `,
    n8nWorkflowId: "  ODCxASjOnuMk8fyW  ",
    n8nWebhookPath: "  replyflow-runtime-abc  ",
  })
  assert.equal(result.ok, true)
})

const REJECTED_SCHEMES = ["http://", "https://", "ftp://", "//"]

for (const scheme of REJECTED_SCHEMES) {
  test(`parseWorkflowMappingInput rejects absolute webhook url "${scheme}..."`, () => {
    const result = parseWorkflowMappingInput({
      workflowId: validWorkflowId,
      n8nWorkflowId: "ODCxASjOnuMk8fyW",
      n8nWebhookPath: `${scheme}n8n.example.com/webhook/replyflow-runtime-abc`,
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /relative/i)
  })
}

test("parseWorkflowMappingInput rejects non-uuid workflow ids", () => {
  for (const workflowId of ["", "not-a-uuid", "7b9e9d4e-6a5c-4f3e", "abc"]) {
    const result = parseWorkflowMappingInput({ workflowId, n8nWorkflowId: "ODCxASjOnuMk8fyW", n8nWebhookPath: "replyflow-runtime-abc" })
    assert.equal(result.ok, false, `expected rejection for "${workflowId}"`)
    if (!result.ok) assert.match(result.error, /workflow reference/i)
  }
})

test("parseWorkflowMappingInput rejects empty or oversized n8n workflow ids", () => {
  const cases = ["", "   ", "a".repeat(257)]
  for (const n8nWorkflowId of cases) {
    const result = parseWorkflowMappingInput({ workflowId: validWorkflowId, n8nWorkflowId, n8nWebhookPath: "replyflow-runtime-abc" })
    assert.equal(result.ok, false, `expected rejection for n8n id length ${n8nWorkflowId.length}`)
    if (!result.ok) assert.match(result.error, /between 1 and 256/i)
  }
})

test("parseWorkflowMappingInput rejects n8n workflow ids with hostile characters", () => {
  for (const n8nWorkflowId of ["ODCxASjOnuMk8fyW/https://evil.example", "ODCxASjOnuMk8fyW\x00x", "ODCx ASjOnuMk8fyW", "ODCx\nASjOnuMk8fyW"]) {
    const result = parseWorkflowMappingInput({ workflowId: validWorkflowId, n8nWorkflowId, n8nWebhookPath: "replyflow-runtime-abc" })
    assert.equal(result.ok, false, `expected rejection for "${JSON.stringify(n8nWorkflowId)}"`)
  }
})

test("parseWorkflowMappingInput rejects empty webhook paths", () => {
  for (const n8nWebhookPath of ["", "   "]) {
    const result = parseWorkflowMappingInput({ workflowId: validWorkflowId, n8nWorkflowId: "ODCxASjOnuMk8fyW", n8nWebhookPath })
    assert.equal(result.ok, false, `expected rejection for "${JSON.stringify(n8nWebhookPath)}"`)
  }
})

test("parseWorkflowMappingInput rejects oversized webhook paths (>300 char)", () => {
  const result = parseWorkflowMappingInput({ workflowId: validWorkflowId, n8nWorkflowId: "ODCxASjOnuMk8fyW", n8nWebhookPath: "a".repeat(301) })
  assert.equal(result.ok, false)
})

test("parseWorkflowMappingInput rejects leading-slash or URL-hostile webhook paths", () => {
  for (const n8nWebhookPath of ["/replyflow-runtime-abc", "replyflow-runtime-abc/../x", "replyflow-runtime abc", "replyflow-runtime-abc&evil=1"]) {
    const result = parseWorkflowMappingInput({ workflowId: validWorkflowId, n8nWorkflowId: "ODCxASjOnuMk8fyW", n8nWebhookPath })
    assert.equal(result.ok, false, `expected rejection for "${JSON.stringify(n8nWebhookPath)}"`)
  }
})

test("updateWorkflowMapping enforces authenticated workspace membership", () => {
  assert.match(actionsSource, /async function updateWorkflowMapping\(formData: FormData\)/)
  assert.match(actionsSource, /await getMembership\(\)/)
  assert.match(actionsSource, /You do not have permission to modify workflows\./)
})

test("updateWorkflowMapping gates on owner/admin/member exactly like existing mutations", () => {
  const block = actionsSource.slice(actionsSource.indexOf("updateWorkflowMapping"))
  assert.match(block, /\["owner", "admin", "member"\]/)
})

test("updateWorkflowMapping scopes both the lookup and the write to the membership organization", () => {
  const block = actionsSource.slice(actionsSource.indexOf("updateWorkflowMapping"))
  assert.match(block, /\.eq\("id", parsed\.value\.workflowId\)/)
  assert.match(block, /\.eq\("organization_id", membership\.organization_id\)/)
  assert.match(block, /\.update\(\{/)
  assert.match(block, /n8n_workflow_id: parsed\.value\.n8nWorkflowId/)
  assert.match(block, /n8n_webhook_path: parsed\.value\.n8nWebhookPath/)
  assert.match(block, /\.eq\("project_id", workflow\.project_id\)/)
  const lookup = block.slice(0, block.indexOf(".update("))
  assert.match(lookup, /\.maybeSingle\(\)/)
})

test("updateWorkflowMapping mitigates cross-organization duplicates with a unique n8n id guard", () => {
  const block = actionsSource.slice(actionsSource.indexOf("updateWorkflowMapping"))
  assert.match(block, /23505/)
  assert.match(block, /already mapped to this n8n workflow id/)
})

test("updateWorkflowMapping revalidates the project dashboard after saving", () => {
  const block = actionsSource.slice(actionsSource.indexOf("updateWorkflowMapping"))
  assert.match(block, /revalidatePath\(\`\/dashboard\/projects\/\$\{workflow\.project_id\}\`\)/)
  assert.match(block, /revalidatePath\("\/dashboard\/projects"\)/)
})

test("project page shows a webhook mapping status and exposes the map webhook control", () => {
  assert.match(pageSource, /WebhookMapButton/)
  assert.match(pageSource, /Webhook mapped/)
  assert.match(pageSource, /Webhook not mapped/)
  assert.match(pageSource, /n8n_workflow_id, n8n_webhook_path/)
})

test("Run now dispatch path is unchanged by the mapping fix", () => {
  assert.match(runActions, /queueWorkflowRun/)
  assert.match(executionService, /workflows!workflow_runs_workflow_id_organization_id_fkey/)
})