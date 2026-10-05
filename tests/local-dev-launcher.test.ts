import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
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
  assert.match(packageJson, /"dev:local:e2e": "node scripts\/run-local-dev\.mjs --container-callbacks"/)
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

test("launcher binds to loopback except when the local E2E callback mode is explicit", () => {
  assert.match(launcher, /args\.includes\("--container-callbacks"\)/)
  assert.match(launcher, /containerCallbacks \? "0\.0\.0\.0" : "127\.0\.0\.1"/)
  assert.match(launcher, /"--hostname", hostname/)
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
    "INTERNAL_AUTOMATION_SECRET",
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

//
// Behavioural coverage for INTERNAL_AUTOMATION_SECRET isolation.
//
// These run the real launcher in a throwaway directory. The launcher derives its
// repo root from its own file location, so copying it into a temp dir makes it
// read that temp dir's `.env.e2e.local` and spawn that temp dir's (absent)
// Next.js binary. Nothing here starts a server or touches a real stack.
//
// All values below are deliberate non-secrets chosen so that a leak is obvious.
//

const LOCAL_STACK: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role-key",
  REPLYFLOW_CALLBACK_SECRET: "fixture-callback-secret",
  N8N_BASE_URL: "http://127.0.0.1:5678",
  N8N_API_KEY: "fixture-n8n-api-key",
  INTERNAL_AUTOMATION_SECRET: "fixture-internal-secret",
}

const HOSTED_ONLY_VALUE = "hosted-only-must-never-be-used-locally"

function renderLocalEnv(omit: string[] = [], blank: string[] = []): string {
  return `${Object.entries(LOCAL_STACK)
    .filter(([name]) => !omit.includes(name))
    .map(([name, value]) => `${name}=${blank.includes(name) ? "" : value}`)
    .join("\n")}\n`
}

function runLauncherInSandbox(files: Record<string, string>): { code: number | null; output: string } {
  const dir = mkdtempSync(join(tmpdir(), "replyflow-launcher-"))
  try {
    mkdirSync(join(dir, "scripts"))
    copyFileSync(
      resolve(process.cwd(), "scripts/run-local-dev.mjs"),
      join(dir, "scripts/run-local-dev.mjs"),
    )
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content, "utf8")
    }
    const result = spawnSync(process.execPath, [join(dir, "scripts/run-local-dev.mjs")], {
      cwd: dir,
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    })
    return { code: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test("launcher accepts a local INTERNAL_AUTOMATION_SECRET and proceeds past validation", () => {
  const { output } = runLauncherInSandbox({ ".env.e2e.local": renderLocalEnv() })

  assert.doesNotMatch(output, /BLOCKED/, "a complete local env file must not be blocked")
  // Printed only after the required-variable gate, so it proves validation ran
  // and passed. The exit code is intentionally not asserted: the sandbox has no
  // Next.js binary, so the launcher exits non-zero *after* this line.
  assert.match(output, /Connected to LOCAL stack/)
  assert.doesNotMatch(output, /fixture-internal-secret/, "must never print a secret value")
})

test("launcher aborts when INTERNAL_AUTOMATION_SECRET is missing from the local env", () => {
  const { code, output } = runLauncherInSandbox({
    ".env.e2e.local": renderLocalEnv(["INTERNAL_AUTOMATION_SECRET"]),
  })

  assert.equal(code, 1)
  assert.match(output, /BLOCKED/)
  // Names the offending variable, but never its value.
  assert.match(output, /INTERNAL_AUTOMATION_SECRET/)
  assert.doesNotMatch(output, /fixture-internal-secret/)
  assert.doesNotMatch(output, /Connected to LOCAL stack/, "must abort before booting Next.js")
})

test("launcher aborts when INTERNAL_AUTOMATION_SECRET is present but empty", () => {
  const { code, output } = runLauncherInSandbox({
    ".env.e2e.local": renderLocalEnv([], ["INTERNAL_AUTOMATION_SECRET"]),
  })

  assert.equal(code, 1)
  assert.match(output, /BLOCKED/)
  assert.match(output, /INTERNAL_AUTOMATION_SECRET/)
})

test("launcher will not fall back to a hosted .env.local value for the internal secret", () => {
  // Regression: when the local file omits the variable, Next.js fills the gap
  // from `.env.local`. The launcher must refuse to start rather than let a
  // hosted secret reach the local process.
  const { code, output } = runLauncherInSandbox({
    ".env.e2e.local": renderLocalEnv(["INTERNAL_AUTOMATION_SECRET"]),
    ".env.local": `INTERNAL_AUTOMATION_SECRET=${HOSTED_ONLY_VALUE}\n`,
  })

  assert.equal(code, 1, "a hosted-only secret must not satisfy local validation")
  assert.match(output, /BLOCKED/)
  assert.match(output, /INTERNAL_AUTOMATION_SECRET/)
  assert.doesNotMatch(output, new RegExp(HOSTED_ONLY_VALUE), "hosted value must never be read or printed")
})