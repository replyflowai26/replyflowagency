import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8")
}

const executionService = readSource("src/lib/automation/execution-service.ts")
const runActions = readSource("src/app/dashboard/projects/[id]/run-actions.ts")
const runObservability = readSource("src/lib/dashboard/run-observability.ts")
const foundationMigration = readSource(
  "supabase/migrations/20260816000003_automation_execution_foundation.sql",
)

//
// The PostgREST embed for `workflows` on `workflow_runs` was ambiguous: the
// table has BOTH a plain FK (workflow_id → workflows.id) and a composite FK
// (workflow_id, organization_id → workflows.id, organization_id). PostgREST
// refuses the bare embed with PGRST201, so dispatch's run lookup failed with
// `runError` and the run was misreported as "Workflow run not found." even
// though the insert had just succeeded.
//

test("workflow_runs defines both a plain FK and a composite FK to workflows (the ambiguity source)", () => {
  assert.match(
    foundationMigration,
    /workflow_id uuid not null references public\.workflows\(id\)/,
  )
  assert.match(
    foundationMigration,
    /foreign key \(workflow_id, organization_id\)[\s\S]*?references public\.workflows\(id, organization_id\)/,
  )
  assert.match(
    foundationMigration,
    /foreign key \(project_id, organization_id\)[\s\S]*?references public\.automation_projects\(id, organization_id\)/,
  )
})

test("dispatch disambiguates the workflows embed via the composite FK", () => {
  assert.match(
    executionService,
    /workflows!workflow_runs_workflow_id_organization_id_fkey\(n8n_webhook_path(?:,\s*n8n_workflow_id)?\)/,
  )
  assert.doesNotMatch(
    executionService,
    /workflows\(n8n_webhook_path\)/,
    "bare ambiguous embed must not be used",
  )
})

test("dispatch run lookup returns the created run so its id can be resolved", () => {
  assert.match(executionService, /workflows!workflow_runs_workflow_id_organization_id_fkey\(n8n_webhook_path(?:,\s*n8n_workflow_id)?\)/)
  assert.match(executionService, /\.eq\("id", runId\)/)
  assert.match(executionService, /\.eq\("organization_id", membership\.organization_id\)/)
  assert.match(executionService, /\.maybeSingle\(\)/)
})

test("database failure is NOT converted into 'Workflow run not found'", () => {
  assert.match(executionService, /if \(runError\) \{/)
  assert.match(executionService, /throw new Error\("Unable to load workflow run\."\)/)
  assert.match(executionService, /if \(!run\) \{/)
  assert.match(executionService, /throw new Error\("Workflow run not found\."\)/)
  const runErrorFirst = executionService.indexOf("if (runError) {")
  const notFoundIdx = executionService.indexOf('throw new Error("Workflow run not found.")')
  assert.ok(runErrorFirst !== -1 && notFoundIdx > runErrorFirst, "runError is checked before !run")
})

test("missing run is reported as 'Workflow run not found'", () => {
  assert.match(executionService, /throw new Error\("Workflow run not found\."\)/)
  assert.doesNotMatch(executionService, /if \(runError \|\| !run\)/, "runError and !run must not be merged")
})

test("run observability disambiguates both the workflows and automation_projects embeds", () => {
  assert.match(
    runObservability,
    /workflows!workflow_runs_workflow_id_organization_id_fkey\(id, name\)/,
  )
  assert.match(
    runObservability,
    /automation_projects!workflow_runs_project_id_organization_id_fkey\(id, name\)/,
  )
  assert.doesNotMatch(runObservability, /workflows\(id, name\)/, "bare workflows embed must not be used")
  assert.doesNotMatch(runObservability, /automation_projects\(id, name\)/, "bare automation_projects embed must not be used")
})

test("Run now queue path inserts a run, returns its id, and navigates there", () => {
  assert.match(runActions, /\.from\("workflow_runs"\)\s*\.insert\(/)
  assert.match(runActions, /\.select\("id"\)\s*\.single\(\)/)
  assert.match(runActions, /if \(runError \|\| !run\) \{[\s\S]*?throw new Error\("Unable to queue workflow run\."\)/)
  assert.match(runActions, /return run\.id/)
})

test("Run now button navigates to the run detail page with the created run id", () => {
  const button = readSource("src/app/dashboard/projects/[id]/workflow-run-button.tsx")
  assert.match(button, /queueWorkflowRun\(formData\)/)
  assert.match(button, /router\.push\(`\/dashboard\/projects\/\$\{projectId\}\/runs\/\$\{runId\}`\)/)
})

test("run detail page loads the created run through the disambiguated read path", () => {
  const runDetail = readSource("src/app/dashboard/projects/[id]/runs/[runId]/page.tsx")
  assert.match(runDetail, /getRunDetail\(/)
  assert.match(runDetail, /notFound\(\)/)
})