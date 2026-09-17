import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

//
// Regression guards for the local login tooling:
//   - scripts/repair-local-auth-nulls.mjs  (non-destructive local auth repair)
//   - scripts/run-local-login-smoke.mjs    (real local login verification)
//   - scripts/run-local-dev.mjs            (local dev launcher)
//
// These cannot call the live stack (unit tests run without Supabase), so they
// pin the safety invariants that make the live harnesses safe to run.
//

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8")
}

const repair = read("scripts/repair-local-auth-nulls.mjs")
const loginSmoke = read("scripts/run-local-login-smoke.mjs")
const launcher = read("scripts/run-local-dev.mjs")
const packageJson = read("package.json")
const gitIgnore = read(".gitignore")
const bridgeConfig = read("tsconfig.bridge-test.json")

test("repair script exists and works only on the local stack", () => {
  assert.match(repair, /\.env\.e2e\.local/)
  assert.match(repair, /isLocalHost/)
  assert.match(repair, /hostname === "localhost"/)
  assert.match(repair, /hostname === "127\.0\.0\.1"/)
  assert.match(repair, /REPLYFLOW_E2E_TARGET/)
  assert.match(repair, /"test"/)
  assert.match(repair, /REPLYFLOW_E2E_PROJECT_REF/)
  assert.match(repair, /"localhost"/)
  assert.match(repair, /docker ps/)
  assert.match(repair, /supabase_db_/)
})

test("repair script is non-destructive: token-column backfill only", () => {
  assert.match(repair, /confirmation_token/)
  assert.match(repair, /recovery_token/)
  assert.match(repair, /email_change_token_new/)
  assert.match(repair, /where \$\{col\} is null/)
  // Must never delete, drop or truncate anything.
  assert.doesNotMatch(repair, /\bDELETE\b/i)
  assert.doesNotMatch(repair, /\bDROP\b/i)
  assert.doesNotMatch(repair, /\bTRUNCATE\b/i)
})

test("repair script never reads or writes .env.local and never logs secrets", () => {
  assert.doesNotMatch(repair, /readFileSync\([^)]*\.env\.local/)
  assert.doesNotMatch(repair, /existsSync\([^)]*\.env\.local/)
  assert.doesNotMatch(repair, /writeFileSync/)
  // Values never reach stdout; only hosts and row counts do.
  assert.doesNotMatch(repair, /console\.(log|error|warn)\([^)]*env\[[A-Z_]+\]/)
})

test("login smoke harness requires the same local-only safety gates", () => {
  assert.match(loginSmoke, /\.env\.e2e\.local/)
  assert.match(loginSmoke, /LOCALHOST_URL_RE/)
  assert.match(loginSmoke, /REPLYFLOW_E2E_TARGET/)
  assert.match(loginSmoke, /"test"/)
  assert.match(loginSmoke, /REPLYFLOW_E2E_PROJECT_REF/)
  assert.match(loginSmoke, /"localhost"/)
  assert.doesNotMatch(loginSmoke, /readFileSync\([^)]*\.env\.local/)
  // No destructive admin calls.
  assert.doesNotMatch(loginSmoke, /method:\s*"DELETE"/i)
})

test("login smoke harness exercises the whole real login chain", () => {
  assert.match(loginSmoke, /grant_type=password/)
  assert.match(loginSmoke, /grant_type=refresh_token/)
  assert.match(loginSmoke, /\/auth\/v1\/logout/)
  assert.match(loginSmoke, /\/dashboard/)
  assert.match(loginSmoke, /\/onboarding/)
  assert.match(loginSmoke, /create_organization/)
  // The browser cookie is named from the endpoint host (sb-<host>-auth-token),
  // matching @supabase/supabase-js / @supabase/ssr — not the legacy default.
  assert.match(loginSmoke, /STORAGE_KEY\s*=\s*`sb-\$\{/)
  assert.match(loginSmoke, /base64-/)
})

test("login smoke harness never prints passwords or tokens", () => {
  // The only file writes persist local test credentials (git-ignored), never stdout.
  assert.doesNotMatch(loginSmoke, /console\.(log|error|warn)\([^)]*password\)/)
  assert.doesNotMatch(loginSmoke, /console\.(log|error|warn)\([^)]*access_token[^)]*\)/)
  assert.doesNotMatch(loginSmoke, /console\.(log|error|warn)\([^)]*refresh_token[^)]*\)/)
  assert.match(loginSmoke, /CREDENTIAL_FILE/)
  assert.match(gitIgnore, /\.local-test-login\.json/)
})

test("local login tooling is registered in package.json and the test bridge", () => {
  assert.match(packageJson, /"local:repair": "node scripts\/repair-local-auth-nulls\.mjs"/)
  assert.match(packageJson, /"test:local:login": "node scripts\/run-local-login-smoke\.mjs"/)
  assert.match(packageJson, /\.test-dist\/tests\/local-login-harness\.test\.js/)
  assert.match(bridgeConfig, /tests\/local-login-harness\.test\.ts/)
})

test("local dev launcher pre-flights the local auth health endpoint", () => {
  assert.match(launcher, /\/auth\/v1\/health/)
  assert.match(launcher, /supabase start/)
  // Explanatory prose may mention .env.local, but the code must never read it.
  assert.doesNotMatch(launcher, /\.env\.local[\"']/)
  assert.doesNotMatch(launcher, /readFileSync\([^)]*\.env\.local/)
  assert.doesNotMatch(launcher, /existsSync\([^)]*\.env\.local/)
})