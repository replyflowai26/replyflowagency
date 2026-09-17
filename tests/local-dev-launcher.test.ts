import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

//
// Guards that keep the app safe when it is started against the LOCAL Supabase
// and n8n stack. Regression for the browser sign-in failure caused by the dev
// server loading `.env.local` (hosted, unreachable) instead of the local stack.
//

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8")
}

function loadEnvFile(relPath: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of read(relPath).split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx < 1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

const launcher = read("scripts/run-local-dev.mjs")
const packageJson = read("package.json")
const gitIgnore = read(".gitignore")
const localEnv = loadEnvFile(".env.e2e.local")

test("dev:local script is wired into package.json and ignores no env file", () => {
  assert.match(packageJson, /"dev:local": "node scripts\/run-local-dev\.mjs"/)
  assert.match(packageJson, /"dev:local:3001": "node scripts\/run-local-dev\.mjs --port 3001"/)
  assert.match(gitIgnore, /\.env\*/)
})

test("launcher loads only .env.e2e.local and never reads or writes .env.local", () => {
  // Comments may mention `.env.local` (backticks) to explain the difference,
  // but the code must never reference or write it.
  assert.doesNotMatch(launcher, /"\.env\.local"/, "code must never reference .env.local")
  assert.doesNotMatch(
    launcher,
    /readFileSync\([^)]*\.env\.local|existsSync\([^)]*\.env\.local/,
    "must never read .env.local",
  )
  assert.match(launcher, /\.env\.e2e\.local/)
  // Read-only: must not write any file.
  assert.doesNotMatch(launcher, /writeFileSync|createWriteStream|appendFileSync|copyFileSync/)
})

test("launcher refuses non-local URLs before booting", () => {
  assert.match(launcher, /isLocalHost/)
  assert.match(launcher, /hostname === "localhost"/)
  assert.match(launcher, /hostname === "127\.0\.0\.1"/)
  assert.match(launcher, /refusing to start against a non-local host/)
})

test("launcher requires every variable the app needs from the local stack", () => {
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REPLYFLOW_CALLBACK_SECRET",
    "N8N_BASE_URL",
    "N8N_API_KEY",
  ]) {
    assert.match(launcher, new RegExp(`"${name}"`), `launcher must verify ${name}`)
  }
})

test("launcher prints only hosts and ports, never values", () => {
  // The status block only prints host/port derived through new URL().host and
  // never the raw value or any key/token variable.
  assert.match(launcher, /new URL\(env\[name\]\)\.host/)
  assert.doesNotMatch(launcher, /console\.log\(.*env\[name\](?!.*\.host)/)
})

test(".env.e2e.local contains the complete local stack configuration", () => {
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "N8N_BASE_URL",
    "N8N_API_KEY",
    "REPLYFLOW_CALLBACK_SECRET",
  ]) {
    assert.ok(localEnv[name], `expected ${name} to be set in .env.e2e.local`)
  }
})

test(".env.e2e.local targets localhost/127.0.0.1 only", () => {
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "N8N_BASE_URL"]) {
    const url = new URL(localEnv[name])
    assert.ok(
      url.hostname === "localhost" || url.hostname === "127.0.0.1",
      `${name} must point at the local stack, got host ${url.hostname}`,
    )
  }
  // The app must never be configured against hosted Supabase from the local file.
  assert.doesNotMatch(read(".env.e2e.local"), /supabase\.co/)
  assert.doesNotMatch(read(".env.e2e.local"), /supabase\.in/)
})