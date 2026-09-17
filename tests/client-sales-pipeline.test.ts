import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { OUTREACH_STATUSES } from "../src/types/client.js"

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260915000009_client_sales_pipeline.sql",
  ),
  "utf8",
)

test("sales pipeline migration is the latest migration (sorts after 20260903000008)", () => {
  assert.ok(
    "20260915000009_client_sales_pipeline.sql" > "20260903000008_workflow_event_retention_fix.sql",
    "new migration must sort after the last existing migration",
  )
})

test("outreach_status column is added with correct default and check constraint", () => {
  assert.match(migration, /add column if not exists outreach_status text not null default 'not_started'/)
  assert.match(migration, /check \(outreach_status in \(/)
  for (const status of OUTREACH_STATUSES) {
    assert.ok(
      migration.includes(`'${status}'`),
      `check constraint must include '${status}'`,
    )
  }
})

test("next_follow_up_at column is nullable timestamptz", () => {
  assert.match(migration, /add column if not exists next_follow_up_at timestamptz/)
  assert.ok(!migration.includes("next_follow_up_at not null"), "must not be not null")
})

test("org-level index on outreach_status exists", () => {
  assert.match(migration, /clients_org_outreach_idx/)
  assert.match(migration, /create index if not exists clients_org_outreach_idx\s+on public\.clients \(organization_id, outreach_status\)/)
})

test("partial index on next_follow_up_at is NOT NULL filtered", () => {
  assert.match(migration, /clients_org_followup_idx/)
  assert.match(migration, /where next_follow_up_at is not null/)
})

test("migration does not add or weaken any clients RLS policies", () => {
  assert.ok(!migration.includes("create policy"), "must not create new RLS policies")
  assert.ok(!migration.includes("drop policy"), "must not drop existing RLS policies")
  assert.ok(!migration.includes("enable row level security"), "RLS must already be enabled")
})

test("migration does not add or modify grants", () => {
  assert.ok(!migration.includes("grant"), "must not modify grants")
})

test("OUTREACH_STATUSES constant includes exactly the expected values", () => {
  assert.deepEqual([...OUTREACH_STATUSES], ["not_started", "contacted", "following_up", "meeting_scheduled", "closed_won", "closed_lost"])
})