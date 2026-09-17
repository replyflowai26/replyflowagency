import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8")
}

const MIGRATION = "supabase/migrations/20260903000008_workflow_event_retention.sql"

test("retention migration never deletes the authoritative workflow_runs", () => {
  const sql = readSource(MIGRATION)
  // The purge targets workflow_run_events only; workflow_runs must never appear
  // in a DELETE/DROP/TRUNCATE statement.
  assert.doesNotMatch(sql, /delete\s+from\s+public\.workflow_runs/i)
  assert.doesNotMatch(sql, /delete\s+from\s+workflow_runs/i)
  assert.doesNotMatch(sql, /truncate/i)
  // Deletion must be scoped to the event table.
  assert.match(sql, /delete from public\.workflow_run_events/i)
  assert.match(sql, /workflow_run_events e/i)
})

test("purge only targets terminal runs and enforces the retention cutoff", () => {
  const sql = readSource(MIGRATION)
  // The terminal-status filter is exhaustive and appears inside the delete predicate.
  const deleteBlock = sql.slice(sql.indexOf("delete from public.workflow_run_events"))
  assert.match(deleteBlock, /status in \('succeeded', 'failed', 'cancelled'\)/i)
  assert.match(deleteBlock, /created_at < v_cutoff/i)
  // Active states must never be candidates for removal.
  assert.doesNotMatch(deleteBlock, /'queued'|'running'/i)
})

test("purge is idempotent and batched to bound the transaction", () => {
  const sql = readSource(MIGRATION)
  assert.match(sql, /limit v_batch/i)
  assert.match(sql, /v_batch integer := greatest\(1, coalesce\(p_batch_limit, 5000\)\)/i)
  assert.match(sql, /order by e2\.created_at asc/i)
})

test("purge joins on both run_id and organization_id (tenant-safe)", () => {
  const sql = readSource(MIGRATION)
  // Join preserves tenant correlation so a run and its events are correlated.
  assert.match(sql, /on r\.id = e2\.run_id/i)
  assert.match(sql, /and r\.organization_id = e2\.organization_id/i)
})

test("append-only guarantee is preserved for normal sessions", () => {
  const sql = readSource(MIGRATION)
  // Only a transaction-scoped GUC lets the privileged purge through.
  assert.match(sql, /current_setting\('replyflow\.purge_authorized', true\) = 'on'/i)
  assert.match(sql, /set_config\('replyflow\.purge_authorized', 'on', true\)/i)
  // Append-only still enforced for every other path.
  assert.match(sql, /raise exception 'audit_events are append-only'/i)
  assert.match(sql, /errcode = '42501'/i)
})

test("purge executes only under the service role (no user escalation)", () => {
  const sql = readSource(MIGRATION)
  assert.match(sql, /security definer/i)
  assert.match(sql, /revoke all on function public\.purge_expired_run_events.*from public/i)
  assert.match(sql, /revoke all on function public\.purge_expired_run_events.*from anon/i)
  assert.match(sql, /revoke all on function public\.purge_expired_run_events.*from authenticated/i)
  assert.match(sql, /grant execute on function public\.purge_expired_run_events.*to service_role/i)
  // Fully-qualified names are required so definer does not inherit caller search_path.
  assert.match(sql, /set search_path = ''/i)
})

test("retention service delegates to rpc and reports a purged count", () => {
  const svc = readSource("src/lib/automation/retention-service.ts")
  assert.match(svc, /import "server-only"/)
  assert.match(svc, /createAdminClient\(\)/)
  assert.match(svc, /\.rpc\("purge_expired_run_events", \{/)
  assert.match(svc, /p_batch_limit/)
  assert.match(svc, /p_retention_days/)
  assert.match(svc, /purged/)
  assert.match(svc, /throw new Error/)
})

test("retention route applies IP rate limiting and returns 429 with Retry-After", () => {
  const route = readSource("src/app/api/internal/automation/retention/route.ts")
  assert.match(route, /rateLimit\(/)
  assert.match(route, /x-forwarded-for/)
  assert.match(route, /RETENTION_RATE_LIMIT/)
  assert.match(route, /RETENTION_RATE_WINDOW_MS/)
  assert.match(route, /\{ status: 429/)
  assert.match(route, /Retry-After/)
  assert.match(route, /X-RateLimit-Limit/)
  assert.match(route, /X-RateLimit-Remaining/)
  assert.match(route, /isAuthorized\(request\)/)
})

test("retention route never bypasses authorization or alters success responses", () => {
  const route = readSource("src/app/api/internal/automation/retention/route.ts")
  assert.match(route, /if \(!limit\.allowed\)/)
  assert.match(route, /if \(!isAuthorized\(request\)\)/)
  const rateLimitHeaderCount = route.match(/rateLimitHeaders/g)?.length ?? 0
  assert.ok(rateLimitHeaderCount >= 4, "rate limit headers should be reused across responses")
})

test("retention route runs as nodejs and force-dynamic like the recovery route", () => {
  const route = readSource("src/app/api/internal/automation/retention/route.ts")
  assert.match(route, /runtime = "nodejs"/)
  assert.match(route, /dynamic = "force-dynamic"/)
})

test("vercel cron schedules daily event retention", () => {
  const cfg = readSource("vercel.json")
  assert.match(cfg, /api\/internal\/automation\/retention/)
  assert.match(cfg, /0 3 \* \* \*/)
})
