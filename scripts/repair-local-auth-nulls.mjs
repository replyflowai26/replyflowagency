// Non-destructive repair for the local Supabase auth schema.
//
// WHY THIS EXISTS
//   Supabase local dev volumes created by an older CLI, then run against a
//   newer GoTrue image, can contain auth.users rows whose internal token
//   columns (confirmation_token, recovery_token, email_change_token_new, …)
//   are NULL. GoTrue >= 2.196 scans those columns as non-nullable strings and
//   fails every auth call that touches such a row with:
//       converting NULL to string is unsupported
//   Browser sign-in then fails with the generic "Unable to sign in right now"
//   message even with correct credentials. This script backfills the NULL
//   token columns to '' (the same neutral value GoTrue itself writes), which is
//   idempotent and deletes nothing.
//
// SAFETY
//   - Local-only: refuses to run unless every configured URL is
//     localhost/127.0.0.1 AND the E2E target gates pass (REPLYFLOW_E2E_TARGET
//     exactly "test", REPLYFLOW_E2E_PROJECT_REF exactly "localhost").
//   - Only ever issues NULL -> '' UPDATEs on auth.users internal token columns.
//   - Discovers the local Postgres container with `docker ps`; aborts unless
//     exactly one Supabase DB container matches the repo project_id.
//   - Never reads or writes .env.local and never prints keys, tokens or
//     passwords.

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))

function loadEnvFile() {
  const file = resolve(REPO_ROOT, ".env.e2e.local")
  if (!existsSync(file)) {
    console.error("[local:repair] FATAL: .env.e2e.local is required (never .env.local).")
    process.exit(1)
  }
  const env = {}
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx < 1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

function isLocalHost(value) {
  try {
    const url = new URL(value)
    return url.hostname === "localhost" || url.hostname === "127.0.0.1"
  } catch {
    return false
  }
}

function projectIdFromConfig() {
  const configPath = resolve(REPO_ROOT, "supabase/config.toml")
  if (!existsSync(configPath)) return null
  const match = readFileSync(configPath, "utf8").match(/^project_id\s*=\s*"([^"]+)"\s*$/m)
  return match ? match[1] : null
}

function projectRefFromUrl(url) {
  const host = url.replace(/^https?:\/\//, "").split("/")[0].split(":")[0]
  return host === "127.0.0.1" ? "localhost" : host
}

const env = loadEnvFile()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL

if (!SUPABASE_URL) {
  console.error("[local:repair] FATAL: no Supabase URL in .env.e2e.local.")
  process.exit(1)
}
if (!isLocalHost(SUPABASE_URL)) {
  console.error(
    `[local:repair] BLOCKED: refusing to repair anything but a local Supabase (host ${new URL(SUPABASE_URL).host}).`,
  )
  process.exit(1)
}
if ((env.REPLYFLOW_E2E_TARGET ?? process.env.REPLYFLOW_E2E_TARGET) !== "test") {
  console.error('[local:repair] BLOCKED: REPLYFLOW_E2E_TARGET must be exactly "test".')
  process.exit(1)
}
const configuredRef = projectRefFromUrl(SUPABASE_URL)
if ((env.REPLYFLOW_E2E_PROJECT_REF ?? process.env.REPLYFLOW_E2E_PROJECT_REF) !== "localhost" || configuredRef !== "localhost") {
  console.error("[local:repair] BLOCKED: REPLYFLOW_E2E_PROJECT_REF must be \"localhost\" and match the local Supabase URL.")
  process.exit(1)
}

function findLocalDbContainer() {
  try {
    const names = execFileSync("docker", ["ps", "--format", "{{.Names}}"], {
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .map((n) => n.trim())
      .filter(Boolean)
    const dbContainers = names.filter((n) => /^supabase_db_/.test(n))
    if (dbContainers.length === 0) {
      console.error("[local:repair] FATAL: no supabase_db_* container is running. Run `supabase start` first.")
      process.exit(1)
    }
    const projectId = projectIdFromConfig()
    const matches = projectId
      ? dbContainers.filter((n) => n.includes(projectId))
      : dbContainers
    if (matches.length !== 1) {
      console.error(
        `[local:repair] FATAL: expected exactly one Supabase DB container for project "${projectId ?? "?"}" but found: ${matches.join(", ")}.`,
      )
      process.exit(1)
    }
    return matches[0]
  } catch (error) {
    console.error(`[local:repair] FATAL: could not inspect Docker: ${error.message}`)
    process.exit(1)
  }
}

// Internal auth token/change columns that GoTrue scans as non-null strings.
const TOKEN_COLUMNS = [
  "confirmation_token",
  "recovery_token",
  "email_change_token_new",
  "email_change_token_current",
  "email_change",
  "phone_change",
  "phone_change_token",
  "reauthentication_token",
]

const container = findLocalDbContainer()
const updates = TOKEN_COLUMNS.map((col) => `update auth.users set ${col} = '' where ${col} is null;`).join("\n")

console.log(`[local:repair] Repairing local auth schema in container "${container}".`)
console.log(`[local:repair] Supabase : ${new URL(SUPABASE_URL).host}`)
try {
  const output = execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"],
    { input: updates, encoding: "utf8" },
  )
  console.log(output.trim())
  console.log("[local:repair] OK: NULL token columns backfilled to '' (non-destructive).")
  console.log("[local:repair] You can now restart the app and sign in; re-run this script after `supabase db reset` if sign-in breaks again.")
} catch (error) {
  console.error(`[local:repair] FAILED: ${error.message}`)
  process.exit(1)
}