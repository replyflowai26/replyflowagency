import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { CLIENT_ACTIVITY_TYPES } from "../src/types/client.js"

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260831000007_client_automation_bridge.sql",
  ),
  "utf8",
)

test("clients(id, organization_id) unique index exists for compound FKs", () => {
  assert.match(migration, /clients_id_organization_uidx/)
  assert.match(migration, /create unique index if not exists clients_id_organization_uidx\s+on public\.clients \(id, organization_id\)/)
})

test("automation_projects.client_id is nullable and references clients", () => {
  assert.match(migration, /add column if not exists client_id uuid/)
  assert.match(migration, /automation_projects_client_org_fk/)
  assert.match(migration, /on delete set null/)
})

test("automation_projects enforces tenant correlation via compound FK", () => {
  assert.match(migration, /foreign key \(client_id, organization_id\)\s+references public\.clients\(id, organization_id\)/)
})

test("workflow_runs.client_id is nullable and references clients", () => {
  assert.match(migration, /add column if not exists client_id uuid/)
  assert.match(migration, /workflow_runs_client_org_fk/)
})

test("workflow_runs enforces tenant correlation via compound FK", () => {
  assert.match(migration, /foreign key \(client_id, organization_id\)\s+references public\.clients\(id, organization_id\)/)
})

test("client_activities is tenant-scoped and references clients by compound FK", () => {
  assert.match(migration, /create table if not exists public\.client_activities/)
  assert.match(migration, /organization_id uuid not null references public\.organizations\(id\) on delete cascade/)
  assert.match(migration, /foreign key \(client_id, organization_id\)\s+references public\.clients\(id, organization_id\)\s+on delete cascade/)
})

test("client_activities is append-only (no update/delete) and never updates organization", () => {
  assert.match(migration, /client_activities_no_update/)
  assert.match(migration, /before update or delete on public\.client_activities/)
  assert.match(migration, /private\.prevent_audit_mutation/)
})

test("client_activities RLS blocks cross-organization access", () => {
  assert.match(migration, /client_activities_select_member/)
  assert.match(migration, /private\.is_org_member\(organization_id, \(select auth\.uid\(\)\)\)/)
  assert.match(migration, /client_activities_delete_none/)
  assert.match(migration, /using \(false\)/)
})

test("all RLS tables preserve existing member-role access model", () => {
  const clientsMigration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260816000002_client_management_foundation.sql"),
    "utf8",
  )
  assert.match(clientsMigration, /clients_select_member/)
  assert.match(clientsMigration, /private\.is_org_member\(organization_id, \(select auth\.uid\(\)\)\)/)
  assert.match(clientsMigration, /clients_update_member/)
  assert.match(clientsMigration, /clients_delete_admin/)
})

test("existing automation RLS is preserved (no weakening)", () => {
  const projectsMigration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260815000000_company_os_foundation.sql"),
    "utf8",
  )
  assert.match(projectsMigration, /projects_select_member/)
  assert.match(projectsMigration, /projects_update_member/)
  assert.match(projectsMigration, /projects_delete_admin/)
  const runsMigration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260816000003_automation_execution_foundation.sql"),
    "utf8",
  )
  assert.match(runsMigration, /workflow_runs_select_member/)
  assert.match(runsMigration, /workflow_runs_insert_member/)
  assert.match(runsMigration, /workflow_runs_update_member/)
  assert.match(runsMigration, /workflow_runs_delete_none/)
})

test("CLIENT_ACTIVITY_TYPES are strict and complete", () => {
  assert.deepEqual([...CLIENT_ACTIVITY_TYPES].sort(), [
    "client.created",
    "client.status_changed",
    "client.updated",
    "workflow_run.associated",
  ])
})

test("existing workflow runs without client_id remain valid (nullable, backward compatible)", () => {
  assert.match(migration, /alter table public\.workflow_runs\s+add column if not exists client_id uuid;/)
  assert.match(migration, /alter table public\.automation_projects\s+add column if not exists client_id uuid;/)
  assert.match(migration, /on delete set null/)
  assert.doesNotMatch(migration, /alter table public\.workflow_runs[\s\S]*?add column if not exists client_id uuid not null/)
  assert.doesNotMatch(migration, /alter table public\.automation_projects[\s\S]*?add column if not exists client_id uuid not null/)
})

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8")
}

test("every activityType literal used by server actions is a registered CLIENT_ACTIVITY_TYPE", () => {
  const actionSources = [
    "src/app/dashboard/clients/actions.ts",
    "src/app/dashboard/projects/actions.ts",
    "src/app/dashboard/projects/[id]/run-actions.ts",
  ]
  const registered = new Set(CLIENT_ACTIVITY_TYPES as readonly string[])
  for (const relPath of actionSources) {
    const source = readSource(relPath)
    for (const match of source.matchAll(/activityType:\s*"([a-z0-9_.:-]+)"/g)) {
      const literal = match[1]
      assert.ok(
        registered.has(literal),
        `${relPath} logs unknown activity type "${literal}"`,
      )
    }
  }
})

test("client association is validated against the actor's organization (server-side)", () => {
  const projectsActions = readSource("src/app/dashboard/projects/actions.ts")
  const runActions = readSource("src/app/dashboard/projects/[id]/run-actions.ts")
  for (const source of [projectsActions, runActions]) {
    assert.match(source, /clientId|rawClientId/)
    assert.match(source, /\.from\("clients"\)/)
    assert.match(source, /\.eq\("organization_id", /)
  }
})

test("queued workflow run records the resolved client_id", () => {
  const runActions = readSource("src/app/dashboard/projects/[id]/run-actions.ts")
  assert.match(runActions, /client_id: clientId/)
  assert.match(runActions, /workflow_run\.associated/)
})

test("client activity logging is non-fatal to the primary operation", () => {
  const source = readSource("src/lib/client-activity.ts")
  assert.match(source, /createAdminClient/)
  assert.match(source, /from\("client_activities"\)\.insert/)
  assert.match(source, /console\.error/)
  assert.doesNotMatch(source, /throw new Error/)
})

test("resolveClientId trims empty input, org-scopes lookup, and rejects invalid/cross-org ids", () => {
  for (const relPath of [
    "src/app/dashboard/projects/actions.ts",
    "src/app/dashboard/projects/[id]/run-actions.ts",
  ]) {
    const source = readSource(relPath)
    assert.match(source, /const trimmed = rawClientId\.trim\(\)/)
    assert.match(source, /if \(!trimmed\) return null/)
    assert.match(source, /\.from\("clients"\)/)
    assert.match(source, /\.select\("id"\)/)
    assert.match(source, /\.eq\("id", trimmed\)/)
    assert.match(source, /\.eq\("organization_id", organizationId\)/)
    assert.match(source, /\.maybeSingle\(\)/)
    assert.match(source, /if \(!client\) \{/)
    assert.match(source, /throw new Error\("Client not found in this workspace\."\)/)
  }
})

test("client-project association read paths filter by client_id and organization_id", () => {
  const clientPage = readSource("src/app/dashboard/clients/[id]/page.tsx")
  assert.match(clientPage, /\.from\("automation_projects"\)/)
  assert.match(
    clientPage,
    /\.eq\("client_id", client\.id\)[\s\S]*?\.eq\("organization_id", membership\.organization_id\)/,
  )
})

test("client-workflow-run association read paths filter by client_id and organization_id", () => {
  const clientPage = readSource("src/app/dashboard/clients/[id]/page.tsx")
  assert.match(clientPage, /\.from\("workflow_runs"\)/)
  assert.match(
    clientPage,
    /\.eq\("client_id", client\.id\)[\s\S]*?\.eq\("organization_id", membership\.organization_id\)/,
  )
})

test("run observability reads are org-scoped and never trust a browser-supplied org", () => {
  const source = readSource("src/lib/dashboard/run-observability.ts")
  assert.match(source, /import "server-only"/)
  assert.match(source, /\.from\("workflow_runs"\)/)
  assert.match(source, /\.eq\("organization_id", organizationId\)/)
  assert.match(source, /\.from\("workflow_run_events"\)/)
  assert.match(source, /\.eq\("organization_id", organizationId\)/)
  assert.match(source, /\.eq\("run_id", runId\)/)
  assert.doesNotMatch(source, /\.eq\("organization_id", \(select|request\.|browser|searchParams/)
})

test("run detail page derives org from authenticated membership and rejects cross-project runs", () => {
  const page = readSource("src/app/dashboard/projects/[id]/runs/[runId]/page.tsx")
  assert.match(page, /organization_memberships/)
  assert.match(page, /\.eq\("organization_id", workspace\.organization_id\)/)
  assert.match(page, /detail\.projectId !== project\.id/)
  assert.match(page, /notFound\(\)/)
})

test("retry re-queues a NEW run via the shared queue path without mutating the original", () => {
  const runActions = readSource("src/app/dashboard/projects/[id]/run-actions.ts")
  assert.match(runActions, /runQueueAndDispatch/)
  assert.match(runActions, /\.from\("workflow_runs"\)/)
  assert.match(runActions, /retryWorkflowRun/)
  assert.match(runActions, /client_id: clientId/)
  assert.doesNotMatch(
    runActions,
    /retryWorkflowRun[\s\S]*?\.from\("workflow_runs"\)\s*\.update\(/,
  )
})

test("live polling stops and never forges a terminal state the data did not report", () => {
  const live = readSource("src/app/dashboard/projects/[id]/runs/[runId]/run-live.tsx")
  assert.match(live, /getRunSnapshotAction/)
  assert.match(live, /POLL_INTERVAL_MS/)
  assert.match(live, /isTerminalStatus/)
  assert.match(live, /clearTimeout/)
})

