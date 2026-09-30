// Local-only development launcher for the ReplyFlow app.
//
// WHY THIS EXISTS
//   Running `next dev` directly loads `.env.local`, whose
//   NEXT_PUBLIC_SUPABASE_URL points at the hosted (remote) Supabase project.
//   From most local machines that hosted project is unreachable, so browser
//   sign-in fails with a generic network error. This launcher instead boots the
//   app against the LOCAL Supabase + n8n stack by injecting the variables in
//   `.env.e2e.local` into the process environment.
//
// SAFETY
//   - Only reads `.env.e2e.local` (git-ignored, operator-managed).
//   - Never reads or writes `.env.local`; the process env takes precedence over
//     every .env file, so a stray hosted value cannot leak into the app.
//   - Aborts unless every URL variable points at localhost/127.0.0.1.
//   - Aborts unless all required variables are present.
//   - Prints only host names and ports — never keys, tokens or secrets.

import { execFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REPLYFLOW_CALLBACK_SECRET",
  "N8N_BASE_URL",
  "N8N_API_KEY",
]

const URL_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "N8N_BASE_URL",
]

// Hosts that are definitively NOT the local development stack.
function isLocalHost(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return url.hostname === "localhost" || url.hostname === "127.0.0.1"
}

function loadEnvFile() {
  const file = resolve(REPO_ROOT, ".env.e2e.local")
  if (!existsSync(file)) {
    throw new Error(
      ".env.e2e.local is missing. Point the app at the local stack by creating it (copy the local values from your Supabase/n8n local setup), or run with the hosted .env.local instead.",
    )
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

async function main() {
  const env = loadEnvFile()

  const missing = REQUIRED.filter((name) => !env[name])
  if (missing.length > 0) {
    console.error(`[dev:local] BLOCKED — missing required variables in .env.e2e.local: ${missing.join(", ")}`)
    process.exit(1)
  }

  const nonLocal = URL_VARS.filter((name) => env[name] && !isLocalHost(env[name]))
  if (nonLocal.length > 0) {
    console.error(
      `[dev:local] BLOCKED — refusing to start against a non-local host (${nonLocal.join(", ")}). ` +
        "This launcher only runs the app against the local Supabase/n8n stack.",
    )
    process.exit(1)
  }

  const show = (name) => (env[name] ? new URL(env[name]).host : "(missing)")
  console.log("[dev:local] Connected to LOCAL stack:")
  console.log(`[dev:local]   Supabase : ${show("NEXT_PUBLIC_SUPABASE_URL")}`)
  console.log(`[dev:local]   n8n      : ${show("N8N_BASE_URL")}`)

  // Non-blocking pre-flight: surface a dead local stack before the browser hits
  // the generic "Unable to sign in" error. Only hosts/status are printed.
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      signal: AbortSignal.timeout(4000),
    })
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
    console.log("[dev:local] local Supabase Auth is healthy")
  } catch (error) {
    console.warn(
      `[dev:local] WARNING: local Supabase Auth is unreachable (${error.message}). ` +
        "Browser sign-in will fail until it is up. Run: supabase start",
    )
  }

  let port = "3000"
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
      port = args[i + 1]
      args.splice(i, 2)
      i--
    }
  }

  const containerCallbacks = args.includes("--container-callbacks")
  if (containerCallbacks) args.splice(args.indexOf("--container-callbacks"), 1)
  const hostname = containerCallbacks ? "0.0.0.0" : "127.0.0.1"

  const accessUrl = `http://127.0.0.1:${port}`
  console.log(
    containerCallbacks
      ? `[dev:local] Starting Next.js for local container callbacks on all interfaces at port ${port} (local URL: ${accessUrl}).\n`
      : `[dev:local] Starting Next.js on ${accessUrl} ...\n`,
  )

  const child = execFile(
    process.execPath,
    [resolve(REPO_ROOT, "node_modules/next/dist/bin/next"), "dev", "--hostname", hostname, "-p", port, ...args],
    { cwd: REPO_ROOT, env: { ...process.env, ...env } },
    (error) => {
      if (error && error.code !== 0 && error.signal !== "SIGTERM") {
        console.error(`[dev:local] Next.js exited with code ${error.code ?? error.signal}`)
      }
    },
  )
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  process.on("SIGINT", () => child.kill("SIGINT"))
  process.on("SIGTERM", () => child.kill("SIGTERM"))
  child.on("exit", (code) => process.exit(code ?? 1))
}

main().catch((error) => {
  console.error(`[dev:local] FATAL: ${error.message}`)
  process.exit(1)
})