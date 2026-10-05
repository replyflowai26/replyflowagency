// Deterministic local E2E runner for the callback chain.
//
// WHY THIS EXISTS
//   The callback E2E test is not self-contained: it POSTs to the local n8n
//   webhook and n8n then calls back into the app's
//   `/api/automation/callback` route. That route only exists while the Next.js
//   dev server is listening. The old workflow had no single command that owned
//   that dependency, so an operator ran `dev:local:e2e` (which is the dev-server
//   launcher, despite the name) and got an orphaned server with no test run.
//
// WHAT THIS GUARANTEES
//   - The dev server is a MANAGED CHILD: started here, always torn down here,
//     including on compile failure, test failure, timeout, or Ctrl+C. No orphan.
//   - The compiled E2E test is executed directly with `node`; its real exit code
//     is this process's exit code.
//   - Refuses to start unless `.env.e2e.local` declares the local test target and
//     every URL points at localhost/127.0.0.1, so it cannot target hosted prod.
//   - Refuses to run if port 3000 is already occupied, so it can never hijack or
//     kill an unrelated server.
//   - Prints hosts, ports and test results only — never keys, tokens or payloads.
//
// The dev server is started through the existing `run-local-dev.mjs
// --container-callbacks` launcher rather than reimplementing it, so the app's
// local-env injection and its non-local-host refusal stay in exactly one place.
// `--container-callbacks` binds 0.0.0.0 so the n8n container can reach the
// callback route; the test itself still talks to 127.0.0.1.

import { spawn, spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createConnection } from "node:net"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))
const DEV_LAUNCHER = resolve(REPO_ROOT, "scripts/run-local-dev.mjs")
const TSC = resolve(REPO_ROOT, "node_modules/typescript/bin/tsc")
const TEST_TS = "tests/local-e2e-callback.test.ts"
const OUT_DIR = ".test-dist-e2e"
const TEST_JS = `${OUT_DIR}/local-e2e-callback.test.js`
const PORT = 3000
const HOST = "127.0.0.1"

// Bounded waits. Nothing here polls indefinitely.
const READY_TIMEOUT_MS = 180_000
const READY_POLL_MS = 500
const WARMUP_TIMEOUT_MS = 120_000
const PORT_FREE_TIMEOUT_MS = 20_000
// The compiled test must terminate on its own: its n8n webhook fetch carries no
// AbortSignal, so a wedged n8n container would otherwise leave this runner
// pending forever while holding the dev server open.
const COMPILE_TIMEOUT_MS = 180_000
const TEST_TIMEOUT_MS = 300_000

// The real test's own markers. A child that exits 0 without printing its verdict
// did not actually run the E2E test, and must never be reported as a pass.
const TEST_BANNER = "ReplyFlow Local E2E Callback Test"
const VERDICT_RE = /LOCAL E2E: (PASS|FAIL)/

const URL_VARS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "N8N_BASE_URL"]

function loadEnvFile() {
  const file = resolve(REPO_ROOT, ".env.e2e.local")
  if (!existsSync(file)) {
    throw new Error(
      ".env.e2e.local is missing. The local E2E test refuses to run without it (it never reads .env.local).",
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

function isLocalHost(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return url.hostname === "localhost" || url.hostname === "127.0.0.1"
}

function preflight() {
  const env = loadEnvFile()

  if (env.REPLYFLOW_E2E_TARGET !== "test") {
    throw new Error(
      'BLOCKED: REPLYFLOW_E2E_TARGET must be exactly "test" in .env.e2e.local to run the local E2E callback test.',
    )
  }
  if (env.REPLYFLOW_E2E_PROJECT_REF !== "localhost") {
    throw new Error(
      'BLOCKED: REPLYFLOW_E2E_PROJECT_REF must be "localhost" in .env.e2e.local to run the local E2E callback test.',
    )
  }
  const nonLocal = URL_VARS.filter((name) => env[name] && !isLocalHost(env[name]))
  if (nonLocal.length > 0) {
    throw new Error(
      `BLOCKED: refusing to run against a non-local host (${nonLocal.join(", ")}). ` +
        "The local E2E callback test only targets the local Supabase/n8n stack.",
    )
  }
  const missing = ["REPLYFLOW_CALLBACK_SECRET", "SUPABASE_SERVICE_ROLE_KEY"].filter((n) => !env[n])
  if (missing.length > 0) {
    throw new Error(`BLOCKED: missing required variables in .env.e2e.local: ${missing.join(", ")}`)
  }

  console.log("[e2e] Target confirmed LOCAL:")
  console.log(`[e2e]   Supabase : ${new URL(env.NEXT_PUBLIC_SUPABASE_URL).host}`)
  console.log(`[e2e]   n8n      : ${new URL(env.N8N_BASE_URL).host}`)
  console.log("[e2e]   ref      : localhost (keys not printed)")
}

function portOpen(port, timeoutMs) {
  return new Promise((done) => {
    const socket = createConnection({ host: HOST, port })
    const finish = (result) => {
      socket.destroy()
      done(result)
    }
    socket.setTimeout(timeoutMs)
    socket.once("connect", () => finish(true))
    socket.once("timeout", () => finish(false))
    socket.once("error", () => finish(false))
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForServerPort(port, server, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    // Fail fast on a launcher that already gave up (e.g. BLOCKED env gate).
    // Waiting out the full timeout here would bury the real reason under a
    // misleading "port never opened" message.
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(
        `The local dev server exited (code ${server.exitCode}) before port ${port} opened. ` +
          "Read its output above for the BLOCKED/FATAL reason.",
      )
    }
    if (await portOpen(port, 1_000)) return
    await sleep(READY_POLL_MS)
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for the local dev server to listen on port ${port}.`)
}

// Force Next.js to compile the callback route before the test's short poll
// window starts. Any HTTP status proves the route is compiled and reachable;
// the request carries no secret and expects no success.
async function warmupCallbackRoute() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS)
  try {
    const res = await fetch(`http://${HOST}:${PORT}/api/automation/callback`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
    console.log(`[e2e] Callback route compiled (warm-up HTTP ${res.status}).`)
  } catch (error) {
    console.warn(`[e2e] WARNING: callback route warm-up failed: ${error.message}`)
  } finally {
    clearTimeout(timer)
  }
}

function killTree(pid) {
  if (!pid) return
  if (process.platform === "win32") {
    // /T is required: `next dev` is a grandchild, and killing only the direct
    // child is exactly what left the orphan server behind.
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" })
  } else {
    try {
      process.kill(-pid, "SIGTERM")
    } catch {
      /* already gone */
    }
  }
}

function runToCompletion(command, args, label, timeoutMs) {
  return new Promise((done) => {
    console.log(`[e2e] ${label}`)
    // Output is teed rather than inherited so the verdict can be verified while
    // still streaming live to the operator.
    const child = spawn(command, args, { cwd: REPO_ROOT, stdio: ["inherit", "pipe", "pipe"], shell: false })
    let output = ""
    let timedOut = false
    const tee = (source, sink) => {
      source.setEncoding("utf8")
      source.on("data", (chunk) => {
        output += chunk
        sink.write(chunk)
      })
    }
    tee(child.stdout, process.stdout)
    tee(child.stderr, process.stderr)

    const timer = setTimeout(() => {
      timedOut = true
      console.error(`[e2e] Timed out after ${timeoutMs}ms during: ${label}. Terminating it.`)
      killTree(child.pid)
    }, timeoutMs)

    child.on("error", (error) => {
      clearTimeout(timer)
      done({ code: 1, output, timedOut, spawnError: error.message })
    })
    // "close" (not "exit") so the verdict is fully flushed before it is read.
    child.on("close", (code) => {
      clearTimeout(timer)
      done({ code: code ?? 1, output, timedOut })
    })
  })
}

async function main() {
  preflight()

  if (!existsSync(TSC)) {
    throw new Error(`TypeScript compiler not found at ${TSC}.`)
  }
  if (await portOpen(PORT, 1_000)) {
    throw new Error(
      `Port ${PORT} is already in use. Stop the existing server first — this runner starts and owns its own, ` +
        "so it will not take over or terminate an unrelated process.",
    )
  }

  // detached so the whole group can be signalled on POSIX; on Windows taskkill /T
  // walks the tree instead.
  const server = spawn(process.execPath, [DEV_LAUNCHER, "--container-callbacks"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    detached: process.platform !== "win32",
  })
  server.on("error", (error) => {
    console.error(`[e2e] FATAL: could not start the local dev server: ${error.message}`)
  })

  let serverExited = false
  server.on("exit", () => {
    serverExited = true
  })

  const stopServer = async () => {
    if (serverExited) return
    console.log("\n[e2e] Stopping the local dev server started for this run ...")
    killTree(server.pid)
    const deadline = Date.now() + PORT_FREE_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (!(await portOpen(PORT, 1_000))) return
      await sleep(READY_POLL_MS)
    }
    console.warn(`[e2e] WARNING: port ${PORT} still occupied after teardown; inspect for a stray server.`)
  }

  // Any exit path from here on tears the server down exactly once.
  process.on("SIGINT", () => {
    killTree(server.pid)
    process.exit(130)
  })
  process.on("SIGTERM", () => {
    killTree(server.pid)
    process.exit(143)
  })

  let testExitCode = 1
  try {
    await waitForServerPort(PORT, server, READY_TIMEOUT_MS)
    console.log(`[e2e] Local dev server is listening on ${HOST}:${PORT}.`)
    if (serverExited) throw new Error("The local dev server exited before the test could run.")
    await warmupCallbackRoute()

    const compile = await runToCompletion(
      process.execPath,
      [
        TSC,
        TEST_TS,
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--strict",
        "--esModuleInterop",
        "--skipLibCheck",
        "--rootDir",
        "tests",
        "--outDir",
        OUT_DIR,
      ],
      `Compiling ${TEST_TS} -> ${OUT_DIR}`,
      COMPILE_TIMEOUT_MS,
    )
    if (compile.spawnError) throw new Error(`tsc could not start: ${compile.spawnError}`)
    if (compile.timedOut || compile.code !== 0) {
      console.error(
        `[e2e] TypeScript compilation FAILED (exit ${compile.code}${compile.timedOut ? ", timed out" : ""}). Test not executed.`,
      )
      testExitCode = compile.code
      return testExitCode
    }

    const run = await runToCompletion(
      process.execPath,
      [resolve(REPO_ROOT, TEST_JS)],
      "Running the E2E test",
      TEST_TIMEOUT_MS,
    )
    if (run.spawnError) throw new Error(`test could not start: ${run.spawnError}`)
    testExitCode = run.code

    // A zero exit code alone does not prove the E2E test ran. Require the real
    // test's own banner and verdict, so a no-op or stubbed compiled file can
    // never be reported as a passing E2E run.
    const sawBanner = run.output.includes(TEST_BANNER)
    const sawVerdict = VERDICT_RE.test(run.output)
    const reportedPass = /LOCAL E2E: PASS/.test(run.output)

    if (run.timedOut) {
      console.error("[e2e] The E2E test timed out and was terminated. Treating as FAILURE.")
      testExitCode = 1
    } else if (!sawBanner || !sawVerdict) {
      console.error(
        "[e2e] FATAL: the E2E test produced no verdict — it did not actually execute. Refusing to report a pass.",
      )
      testExitCode = 1
    } else if (testExitCode === 0 && !reportedPass) {
      console.error("[e2e] FATAL: the E2E test reported a non-pass verdict but exited 0. Treating as FAILURE.")
      testExitCode = 1
    }

    console.log(`[e2e] E2E test process exited with code ${testExitCode}.`)
    return testExitCode
  } finally {
    await stopServer()
  }
}

main()
  .then((code) => process.exit(code ?? 1))
  .catch(async (error) => {
    console.error(`[e2e] FATAL: ${error.message}`)
    process.exit(1)
  })