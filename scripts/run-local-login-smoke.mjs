// Local login smoke test for ReplyFlow.
//
// Verifies the REAL local login chain against the local Supabase Auth + REST
// API and the running Next.js app:
//   1. local GoTrue is reachable
//   2. a dedicated local smoke user exists (auto-created via admin API)
//   3. password sign-in (signInWithPassword) succeeds
//   4. the session token is accepted (session is valid)
//   5. a refresh-token grant succeeds (session survives refresh)
//   6. logout invalidates the session
//   7. the app (npm run dev:local) serves /login and wires the browser client
//      to the LOCAL Supabase, not hosted
//   8. an unauthenticated /dashboard request redirects to /login
//   9. the real dashboard renders for an authenticated user (running the same
//      onboarding create_organization path the app uses)
//
// SAFETY
//   - Same gate as the E2E callback test: refuses to start unless
//     REPLYFLOW_E2E_TARGET is exactly "test", REPLYFLOW_E2E_PROJECT_REF is
//     exactly "localhost", and every configured URL is localhost/127.0.0.1.
//   - Loads ONLY .env.e2e.local (never .env.local), so hosted values can't
//     leak in.
//   - Creates/reuses one dedicated smoke user (email login-smoke@localhost.dev)
//     and never touches other accounts. It does not delete anything.
//   - Never prints passwords, tokens or secrets. If it generates a password it
//     writes it to the git-ignored file .local-test-login.json instead.
//
// USAGE
//   npm run dev:local            (in one terminal)
//   node scripts/run-local-login-smoke.mjs [--app http://127.0.0.1:3000]

import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))
const SMOKE_EMAIL = "login-smoke@localhost.dev"
const CREDENTIAL_FILE = resolve(REPO_ROOT, ".local-test-login.json")

function loadEnvFile() {
  const file = resolve(REPO_ROOT, ".env.e2e.local")
  if (!existsSync(file)) {
    console.error("[login-smoke] FATAL: .env.e2e.local is required (never .env.local).")
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

const env = loadEnvFile()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || process.env.SUPABASE_URL
const PUBLISHABLE_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const appArgIndex = process.argv.indexOf("--app")
const APP_URL = appArgIndex >= 0 && process.argv[appArgIndex + 1]
  ? process.argv[appArgIndex + 1]
  : process.env.REPLYFLOW_APP_URL ?? "http://127.0.0.1:3000"

const LOCALHOST_URL_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_KEY) {
  console.error("[login-smoke] FATAL: missing env vars in .env.e2e.local")
  process.exit(1)
}
if (!LOCALHOST_URL_RE.test(SUPABASE_URL)) {
  console.error("[login-smoke] BLOCKED: Supabase URL must target localhost/127.0.0.1 only.")
  process.exit(1)
}
if (!LOCALHOST_URL_RE.test(new URL(APP_URL).origin)) {
  console.error("[login-smoke] BLOCKED: app URL must target localhost/127.0.0.1 only.")
  process.exit(1)
}
if ((env.REPLYFLOW_E2E_TARGET ?? process.env.REPLYFLOW_E2E_TARGET) !== "test") {
  console.error('[login-smoke] BLOCKED: REPLYFLOW_E2E_TARGET must be exactly "test".')
  process.exit(1)
}
function projectRefFromUrl(url) {
  const host = url.replace(/^https?:\/\//, "").split("/")[0].split(":")[0]
  return host === "127.0.0.1" ? "localhost" : host
}
if ((env.REPLYFLOW_E2E_PROJECT_REF ?? process.env.REPLYFLOW_E2E_PROJECT_REF) !== "localhost" || projectRefFromUrl(SUPABASE_URL) !== "localhost") {
  console.error("[login-smoke] BLOCKED: REPLYFLOW_E2E_PROJECT_REF must be \"localhost\" and match the local Supabase URL.")
  process.exit(1)
}

// supabase-js derives the default auth storage key from the endpoint host:
// `sb-<first-host-segment>-auth-token` (e.g. sb-127-auth-token for
// http://127.0.0.1:54321). @supabase/ssr only overrides it when
// cookieOptions.name is set (the app does not), so this is the exact cookie
// name the app reads on every request.
const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`

const authHeaders = { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" }

function ok(label, detail = "") {
  console.log(`  PASS  ${detail ? `${label} — ${detail}` : label}`)
}
function fail(label, detail = "") {
  console.log(`  FAIL  ${detail ? `${label} — ${detail}` : label}`)
}

async function json(url, init = {}) {
  const res = await fetch(url, init)
  let body = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON body */
  }
  return { res, body }
}

async function main() {
  console.log("\n═══ ReplyFlow Local Login Smoke Test ═══\n")
  console.log(`  Supabase : ${new URL(SUPABASE_URL).host}`)
  console.log(`  App       : ${new URL(APP_URL).host}`)
  console.log(`  Account   : ${SMOKE_EMAIL}\n`)

  let failures = 0

  // 1. Local GoTrue must be reachable.
  try {
    const health = await fetch(`${SUPABASE_URL}/auth/v1/health`, { signal: AbortSignal.timeout(5000) })
    if (health.status === 200) ok("local Supabase Auth is reachable")
    else {
      fail("local Supabase Auth unreachable", `HTTP ${health.status}`)
      failures++
    }
  } catch (error) {
    fail("local Supabase Auth unreachable", error.message)
    failures++
  }

  // 2. Dedicated smoke user must exist with known credentials.
  const password =
    (process.env.REPLYFLOW_LOCAL_TEST_PASSWORD || env.REPLYFLOW_LOCAL_TEST_PASSWORD)
    ?? randomBytes(18).toString("base64url")
  if (!(process.env.REPLYFLOW_LOCAL_TEST_PASSWORD || env.REPLYFLOW_LOCAL_TEST_PASSWORD)) {
    writeFileSync(CREDENTIAL_FILE, JSON.stringify({ email: SMOKE_EMAIL, password }, null, 2), "utf8")
  }

  let userId = null
  const list = await json(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (list.res.status !== 200) {
    fail("admin users list", `HTTP ${list.res.status}`)
    failures++
  } else {
    const found = (list.body?.users ?? []).find((u) => u.email === SMOKE_EMAIL)
    if (found) {
      userId = found.id
      ok("smoke user already present")
    } else {
      const created = await json(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: SMOKE_EMAIL, password, email_confirm: true, user_metadata: { display_name: "Local Login Smoke" } }),
      })
      if (created.res.status === 200 || created.res.status === 201) {
        userId = created.body?.id
        ok("smoke user created")
      } else {
        fail("smoke user create", `HTTP ${created.res.status}`)
        failures++
      }
    }
  }

  if (userId) {
    // Guarantee the account password matches this harness every run.
    const patched = await json(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    if (patched.res.status === 200) ok("smoke user credentials ensured")
    else {
      fail("smoke user credential update", `HTTP ${patched.res.status}`)
      failures++
    }
  }

  // 3. Password sign-in (the login the browser performs).
  const granted = await json(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ email: SMOKE_EMAIL, password }),
  })
  const session = granted.body
  if (granted.res.status === 200 && session?.access_token && session?.refresh_token) {
    ok("login (password grant) succeeded", `expires_in=${session.expires_in}s`)
  } else {
    fail("login (password grant)", `HTTP ${granted.res.status}${session?.error_code ? ` ${session.error_code}` : ""}`)
    failures++
    console.log(
      "\n  If login fails here, run:  node scripts/repair-local-auth-nulls.mjs\n" +
      `  then retry. The most common cause is a local auth schema that GoTrue cannot scan.`,
    )
  }

  let accessToken = session?.access_token
  if (!accessToken) {
    console.error("\n═══ LOCAL LOGIN SMOKE: FAIL — no session issued ═══\n")
    process.exit(1)
  }

  // 4. The issued token must be accepted (session valid).
  const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` },
  })
  if (me.status === 200) ok("session is valid (token accepted)")
  else {
    fail("session validity", `HTTP ${me.status}`)
    failures++
  }

  // 5. Refresh grant (session survives refresh).
  const refreshed = await json(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  if (refreshed.res.status === 200 && refreshed.body?.access_token && refreshed.body?.refresh_token) {
    ok("refresh grant succeeded (session survives refresh)")
    accessToken = refreshed.body.access_token
  } else {
    fail("refresh grant", `HTTP ${refreshed.res.status}`)
    failures++
  }

  // 6. Logout invalidates the session.
  const loggedOut = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: "{}",
  })
  const afterLogout = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` },
  })
  if (loggedOut.status === 204 && (afterLogout.status === 401 || afterLogout.status === 403)) {
    ok("logout invalidates the session")
  } else {
    fail("logout", `logout=${loggedOut.status} after=${afterLogout.status}`)
    failures++
  }

  // 7. App-level checks. Re-login for a fresh session and build the exact
  //    cookie @supabase/ssr writes so the request mirrors a real browser.
  const regranted = await json(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ email: SMOKE_EMAIL, password }),
  })
  if (regranted.res.status === 200 && regranted.body?.access_token) {
    ok("re-login for app-level checks")
  } else {
    fail("re-login", `HTTP ${regranted.res.status}`)
    failures++
    console.error("\n═══ LOCAL LOGIN SMOKE: FAIL ═══\n")
    process.exit(1)
  }

  const cookieHeader = buildSessionCookieHeader(regranted.body)

  // 7a. The app must be up and the browser bundle must target the LOCAL stack.
  let appUp = true
  try {
    const loginPage = await fetch(`${APP_URL}/login`, { signal: AbortSignal.timeout(10000) })
    if (loginPage.status === 200) {
      ok("app /login is served")
      const html = await loginPage.text()
      const srcs = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1])
      let sawHosted = false
      const hostedRefRe = /\b[a-z0-9]{20}\.supabase\.co\b/
      for (const src of srcs.slice(0, 15)) {
        const abs = src.startsWith("http") ? src : `${APP_URL}${src}`
        try {
          const chunk = await (await fetch(abs, { signal: AbortSignal.timeout(8000) })).text()
          // A real hosted project ref is exactly 20 lowercase alphanumerics
          // (e.g. bgluypxphfutryenwtld.supabase.co). supabase-js bundles a
          // hardcoded example domain (xyzcompany.supabase.co) that must not
          // count.
          if (hostedRefRe.test(chunk) && !chunk.includes("127.0.0.1:54321")) sawHosted = true
        } catch {
          /* ignore a chunk that could not be fetched */
        }
      }
      if (sawHosted) {
        fail("browser client targets HOSTED Supabase", "start the app with `npm run dev:local`")
        failures++
      } else {
        ok("browser client targets the LOCAL Supabase stack")
      }
    } else {
      fail("app /login", "HTTP " + loginPage.status + " - is 'npm run dev:local' running?")
      failures++
      appUp = false
    }
  } catch (error) {
    fail("app /login reachable", error.message + " - run 'npm run dev:local' first")
    failures++
    appUp = false
  }

  if (appUp) {
    // 7b. Unauthenticated dashboard must redirect to /login.
    const unauth = await fetch(`${APP_URL}/dashboard`, { redirect: "manual" })
    const location = unauth.headers.get("location") ?? ""
    if (unauth.status >= 300 && unauth.status < 400 && location.includes("/login")) {
      ok("unauthenticated /dashboard redirects to /login")
    } else {
      fail("unauthenticated /dashboard guard", `status=${unauth.status} location=${location}`)
      failures++
    }

    // 7c. Authenticated dashboard must render. A fresh account has no
    //     workspace, so it first hits onboarding; run create_organization (the
    //     real onboarding path) and confirm the dashboard then renders.
    let dashboardStatus = 0
    let dashboardLocation = ""
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${APP_URL}/dashboard`, {
        redirect: "manual",
        headers: { Cookie: cookieHeader },
      })
      if (res.status === 200) {
        dashboardStatus = 200
        break
      }
      if (res.status >= 300 && res.status < 400) {
        dashboardStatus = res.status
        dashboardLocation = res.headers.get("location") ?? ""
        if (dashboardLocation.includes("/onboarding") && attempt === 0) {
          const org = await json(`${SUPABASE_URL}/rest/v1/rpc/create_organization`, {
            method: "POST",
            headers: {
              ...authHeaders,
              Authorization: `Bearer ${regranted.body.access_token}`,
            },
            body: JSON.stringify({
              organization_name: "Local Login Smoke Org",
              organization_slug: `local-login-smoke-${Date.now()}`,
            }),
          })
          if (org.res.status === 200) {
            ok("onboarding create_organization succeeded")
            continue
          }
          fail("onboarding create_organization", `HTTP ${org.res.status}`)
          failures++
          break
        }
        break
      }
    }
    if (dashboardStatus === 200) {
      ok("authenticated /dashboard renders", "session cookie persisted end-to-end")
    } else {
      fail("authenticated /dashboard", `status=${dashboardStatus} location=${dashboardLocation}`)
      failures++
    }
  }

  console.log(failures === 0 ? "\n═══ LOCAL LOGIN SMOKE: PASS ✓ ═══\n" : "\n═══ LOCAL LOGIN SMOKE: FAIL ═══\n")
  process.exit(failures === 0 ? 0 : 1)
}

// ─── @supabase/ssr cookie encoding ─────────────────────────────────────────
// Mirrors how @supabase/ssr v0.12 persists a session: storage key
// sb-<first-host-segment>-auth-token (STORAGE_KEY, derived above), value
// "base64-<base64url(JSON)>", chunked at 3180 encoded chars (chunks named
// key.0, key.1, …).
function buildSessionCookieHeader(session) {
  const payload = {
    access_token: session.access_token,
    token_type: session.token_type ?? "bearer",
    expires_in: session.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
    refresh_token: session.refresh_token,
    user: session.user ?? null,
    provider_token: null,
    provider_refresh_token: null,
  }
  const encoded = `base64-${Buffer.from(JSON.stringify(payload), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`
  // Mirror @supabase/ssr createChunks: split the URI-encoded value at
  // MAX_CHUNK_SIZE = 3180 on valid boundaries, then decode each head back.
  const CHUNK_SIZE = 3180
  let uriValue = encodeURIComponent(encoded)
  const chunks = []
  while (uriValue.length > 0) {
    let head = uriValue.slice(0, CHUNK_SIZE)
    const lastEscape = head.lastIndexOf("%")
    if (lastEscape > CHUNK_SIZE - 3) head = head.slice(0, lastEscape)
    chunks.push(decodeURIComponent(head))
    uriValue = encodeURIComponent(encoded.slice(chunks.join("").length))
  }
  const entries =
    chunks.length === 1 ? [[STORAGE_KEY, chunks[0]]] : chunks.map((c, i) => [`${STORAGE_KEY}.${i}`, c])
  return entries.map(([name, val]) => `${name}=${val}`).join("; ")
}

main().catch((error) => {
  console.error("[login-smoke] FATAL:", error.message)
  process.exit(1)
})