// First-client pilot readiness report (local, read-only).
//
// Prints what is configured/blocked for a lead-capture pilot WITHOUT revealing
// any secret value, touching a database, or making a network call. It reads
// `process.env` for PRESENCE only and checks which migration files exist on
// disk. `STAGING VERIFICATION REQUIRED` is the best possible local verdict; it
// is never a claim that the pilot is live-ready.
//
// Run via `npm run pilot:readiness`. Exit code is always 0: this is a report,
// not a CI gate.

import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))

const readiness = require(resolve(REPO_ROOT, ".test-dist/src/lib/operations/pilot-readiness.js"))

const presentFiles = readiness.PILOT_MIGRATION_FILES.filter((file) =>
  existsSync(resolve(REPO_ROOT, file)),
)

const report = readiness.buildPilotReadinessReport({
  env: process.env,
  presentFiles,
})

const SYMBOL = {
  present: "[present]",
  missing: "[missing]",
  invalid: "[invalid]",
  unverified: "[unverified]",
}

console.log("ReplyFlow AI — first-client pilot readiness")
console.log("=============================================")
console.log("")
for (const check of report.checks) {
  console.log(`${SYMBOL[check.status]} ${check.label}`)
  console.log(`          ${check.detail}`)
}
console.log("")
console.log(
  `Summary: ${report.summary.present} present · ${report.summary.missing} missing · ` +
    `${report.summary.invalid} invalid · ${report.summary.unverified} unverified ` +
    `(of ${report.summary.total})`,
)
console.log(`Verdict: ${report.verdict}`)
console.log("")
console.log("Go-live sequence (human-owned steps are not automated):")
console.log("  1. CEO authorization + §23 commit/push (task 62).")
console.log("  2. B1 staging backup decision, then B2: apply the 3 migrations via the reviewed preflight.")
console.log("  3. Configure staging env NAMES (values entered by the human, never in this repo).")
console.log("  4. Signed dry-run to a staging CRM endpoint; confirm hot-lead gate and single delivery.")
console.log("  5. Client-supplied CRM endpoint + secret (B5) and fixed pilot price (B6).")
console.log("  6. Point one inbound channel at the staging/live intake URL; verify acceptance criteria.")
console.log("")
console.log("Not claimed by this report: real database, real n8n, real CRM, hosted CI, or production readiness.")
