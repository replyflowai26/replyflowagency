/**
 * First-client pilot readiness doctor (task 61).
 *
 * Contract under test:
 *   1. Presence-only env reporting — no secret value is ever returned.
 *   2. Shape validation of the CRM URL without echoing it.
 *   3. Migrations present on disk are never claimed as "applied".
 *   4. The best local verdict is "STAGING VERIFICATION REQUIRED"; a missing or
 *      invalid local prerequisite is "NOT READY".
 *   5. The local mock demo remains available without any configuration.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  buildPilotReadinessReport,
  PILOT_ENV_NAMES,
  PILOT_MIGRATION_FILES,
} from "../src/lib/operations/pilot-readiness"

const ALL_ENV: Record<string, string> = {
  REPLYFLOW_LEAD_INTAKE_SECRET: "fixture-intake-secret-value",
  REPLYFLOW_CRM_WEBHOOK_URL: "https://crm.example.test/hooks/leads",
  REPLYFLOW_CRM_WEBHOOK_SECRET: "fixture-crm-secret-value",
  NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key-value",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role-value",
}

const ALL_FILES = [...PILOT_MIGRATION_FILES]

function check(report: ReturnType<typeof buildPilotReadinessReport>, id: string) {
  const found = report.checks.find((c) => c.id === id)
  assert.ok(found, `expected check ${id}`)
  return found
}

test("no configuration means NOT READY, with every env name reported missing", () => {
  const report = buildPilotReadinessReport({ env: {}, presentFiles: ALL_FILES })

  for (const name of PILOT_ENV_NAMES) {
    assert.equal(check(report, `env:${name}`).status, "missing", name)
  }
  assert.equal(check(report, "crm-url:shape").status, "missing")
  assert.equal(report.summary.missing, PILOT_ENV_NAMES.length + 1)
  assert.equal(report.verdict, "NOT READY")
})

test("a complete, valid configuration is only 'STAGING VERIFICATION REQUIRED'", () => {
  const report = buildPilotReadinessReport({ env: ALL_ENV, presentFiles: ALL_FILES })

  for (const name of PILOT_ENV_NAMES) {
    assert.equal(check(report, `env:${name}`).status, "present", name)
  }
  assert.equal(check(report, "crm-url:shape").status, "present")
  // Migrations exist locally but are never reported as applied.
  for (const file of PILOT_MIGRATION_FILES) {
    const id = `migration:${file.split("/").pop()}`
    const found = check(report, id)
    assert.equal(found.status, "unverified")
    assert.match(found.detail, /NOT applied/)
  }
  assert.equal(check(report, "staging:e2e").status, "unverified")
  assert.equal(check(report, "commercial:pricing").status, "unverified")
  assert.equal(report.verdict, "STAGING VERIFICATION REQUIRED")
  assert.notEqual(report.verdict, "READY")
})

test("a remote plaintext CRM URL is invalid, and an insecure or credentialed URL never leaks", () => {
  const cases = [
    "http://crm.example.test/hooks/leads",
    "https://user:password@crm.example.test/hooks/leads",
    "not-a-url",
  ]
  for (const url of cases) {
    const report = buildPilotReadinessReport({
      env: { ...ALL_ENV, REPLYFLOW_CRM_WEBHOOK_URL: url },
      presentFiles: ALL_FILES,
    })
    assert.equal(check(report, "crm-url:shape").status, "invalid", url)
    assert.equal(report.verdict, "NOT READY")
    // The configured value must never appear in the report.
    const serialized = JSON.stringify(report)
    assert.equal(serialized.includes(url), false, `leaked URL: ${url}`)
    assert.equal(serialized.includes("password"), false)
  }
})

test("a loopback http CRM endpoint is accepted for local dry-runs", () => {
  const report = buildPilotReadinessReport({
    env: { ...ALL_ENV, REPLYFLOW_CRM_WEBHOOK_URL: "http://localhost:5678/webhook/leads" },
    presentFiles: ALL_FILES,
  })
  assert.equal(check(report, "crm-url:shape").status, "present")
})

test("a missing migration file blocks local readiness", () => {
  const report = buildPilotReadinessReport({
    env: ALL_ENV,
    presentFiles: [PILOT_MIGRATION_FILES[0]],
  })
  const missing = check(report, `migration:${PILOT_MIGRATION_FILES[1].split("/").pop()}`)
  assert.equal(missing.status, "missing")
  assert.equal(report.verdict, "NOT READY")
})

test("blank env values count as missing, never as configured", () => {
  const report = buildPilotReadinessReport({
    env: { ...ALL_ENV, REPLYFLOW_LEAD_INTAKE_SECRET: "   " },
    presentFiles: ALL_FILES,
  })
  assert.equal(check(report, "env:REPLYFLOW_LEAD_INTAKE_SECRET").status, "missing")
})

test("no secret or credential value appears anywhere in the report", () => {
  const report = buildPilotReadinessReport({ env: ALL_ENV, presentFiles: ALL_FILES })
  const serialized = JSON.stringify(report)
  for (const name of PILOT_ENV_NAMES) {
    const value = ALL_ENV[name]
    assert.equal(serialized.includes(value), false, `leaked ${name}`)
  }
  assert.equal(serialized.includes("crm.example.test"), false)
  assert.equal(serialized.includes("supabase.co"), false)
})

test("the local mock demo is reported available without credentials", () => {
  const report = buildPilotReadinessReport({ env: {}, presentFiles: [] })
  assert.equal(report.demoCapable, true)
  assert.equal(check(report, "demo:local-mock").status, "present")
})

test("the readiness command is wired into package.json and the bridge build", () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts: Record<string, string>
  }
  assert.ok(pkg.scripts["pilot:readiness"], "npm run pilot:readiness must exist")
  assert.match(pkg.scripts["pilot:readiness"], /scripts\/pilot-readiness\.mjs/)

  const tsconfig = readFileSync(join(process.cwd(), "tsconfig.bridge-test.json"), "utf8")
  assert.match(tsconfig, /tests\/pilot-readiness\.test\.ts/)
  assert.match(tsconfig, /src\/lib\/operations\/pilot-readiness\.ts/)
})
