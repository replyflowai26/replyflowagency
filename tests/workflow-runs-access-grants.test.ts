import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260916000010_workflow_runs_access_grants.sql",
  ),
  "utf8",
)

const foundationMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260816000003_automation_execution_foundation.sql",
  ),
  "utf8",
)

test("access-grants migration sorts after 20260915000009_client_sales_pipeline", () => {
  assert.ok(
    "20260916000010_workflow_runs_access_grants.sql" >
      "20260915000009_client_sales_pipeline.sql",
    "new migration must sort after the last existing migration",
  )
})

test("foundation migration enables RLS but never granted SELECT to authenticated", () => {
  assert.ok(
    foundationMigration.includes("enable row level security"),
    "RLS must already be enabled by the foundation migration",
  )
  assert.ok(
    !foundationMigration.includes("grant select"),
    "foundation migration must not contain SELECT grants (that is this fix's job)",
  )
})

test("grant migration gives workflow_runs SELECT, INSERT, UPDATE to authenticated", () => {
  assert.ok(
    migration.includes("grant select, insert, update on public.workflow_runs to authenticated"),
    "workflow_runs must grant select, insert, update to authenticated",
  )
})

test("grant migration gives workflow_run_events SELECT, INSERT to authenticated", () => {
  assert.ok(
    migration.includes("grant select, insert on public.workflow_run_events to authenticated"),
    "workflow_run_events must grant select, insert to authenticated",
  )
})

test("migration does not touch RLS policies", () => {
  assert.ok(!migration.includes("create policy"), "must not create new RLS policies")
  assert.ok(!migration.includes("drop policy"), "must not drop existing RLS policies")
})

test("migration does not grant DELETE on either table", () => {
  assert.ok(
    !migration.match(/grant\s+[^)]*delete\s+on\s+public\.workflow_runs/i),
    "must not grant DELETE on workflow_runs (runs are immutable audit records)",
  )
  assert.ok(
    !migration.match(/grant\s+[^)]*delete\s+on\s+public\.workflow_run_events/i),
    "must not grant DELETE on workflow_run_events",
  )
})
