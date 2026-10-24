// First-client pilot readiness doctor (pure, side-effect free).
//
// This module answers one question with evidence — "what is still missing
// before a paid lead-capture pilot can go live?" — without ever reading,
// printing or storing a secret VALUE, without a database, and without network
// access. Callers supply an env-shaped record and the list of files present on
// disk; the module returns statuses and safe human-readable details only.
//
// Two honesty rules are enforced by construction:
//   1. Presence is not validity: a configured env NAME is reported as
//      `present`, never as "working". A CRM URL is additionally shape-checked
//      (https or loopback http, no embedded credentials) and reported
//      `present`/`invalid` — never echoed.
//   2. Local readiness is not production readiness: migrations that exist on
//      disk are reported `unverified` ("present locally; not applied — staging
//      check required"). Staging E2E and pricing are always `unverified` because
//      they are owned by the human CEO / a live environment (B1/B2, B6).
//
// The CLI (`npm run pilot:readiness`) feeds this module from `process.env` and
// the repository tree.

import { normalizeCrmWebhookUrl } from "../automation/integration-adapter"

export const PILOT_ENV_NAMES = [
  "REPLYFLOW_LEAD_INTAKE_SECRET",
  "REPLYFLOW_CRM_WEBHOOK_URL",
  "REPLYFLOW_CRM_WEBHOOK_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const

export type PilotEnvName = (typeof PILOT_ENV_NAMES)[number]

export const PILOT_MIGRATION_FILES = [
  "supabase/migrations/20261005000000_workflow_run_approval_state.sql",
  "supabase/migrations/20261006000000_agent_runtime_foundation.sql",
  "supabase/migrations/20261007000000_restrict_workflow_run_transition_and_approval.sql",
] as const

export type PilotCheckStatus = "present" | "missing" | "invalid" | "unverified"

export type PilotCheck = {
  id: string
  label: string
  status: PilotCheckStatus
  /** Safe explanation. Never contains an env value or a credential. */
  detail: string
}

export type PilotReadinessReport = {
  checks: readonly PilotCheck[]
  summary: {
    present: number
    missing: number
    invalid: number
    unverified: number
    total: number
  }
  /**
   * `NOT READY` when a required local prerequisite is missing/invalid.
   * `STAGING VERIFICATION REQUIRED` when every locally checkable prerequisite is
   * satisfied — this is NEVER a claim that the pilot is live-ready. Staging
   * E2E, the client CRM endpoint and pricing still need human/live confirmation.
   */
  verdict: "NOT READY" | "STAGING VERIFICATION REQUIRED"
  /** True when the mock-backed local demo can run (no credentials required). */
  demoCapable: boolean
}

export type PilotReadinessInput = {
  env: Readonly<Record<string, string | undefined>>
  /** Repository-relative paths that actually exist on disk. */
  presentFiles: readonly string[]
}

function envDetail(status: PilotCheckStatus, name: string): string {
  if (status === "present") return `${name} is configured (value not shown).`
  return `${name} is not configured.`
}

function envCheck(env: Readonly<Record<string, string | undefined>>, name: PilotEnvName): PilotCheck {
  const raw = env[name]
  const present = typeof raw === "string" && raw.trim().length > 0
  return {
    id: `env:${name}`,
    label: name,
    status: present ? "present" : "missing",
    detail: envDetail(present ? "present" : "missing", name),
  }
}

/**
 * Shape-check the CRM webhook URL without returning it. Only called when the
 * URL is configured; a malformed/insecure URL is reported `invalid` with a
 * fixed reason code so the operator can fix it without any value appearing in
 * logs or reports.
 */
function crmUrlCheck(env: Readonly<Record<string, string | undefined>>): PilotCheck {
  const name = "REPLYFLOW_CRM_WEBHOOK_URL"
  const raw = env[name]
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {
      id: "crm-url:shape",
      label: "CRM webhook URL shape",
      status: "missing",
      detail: `${name} is not configured.`,
    }
  }
  const normalized = normalizeCrmWebhookUrl(raw.trim())
  if (!normalized) {
    return {
      id: "crm-url:shape",
      label: "CRM webhook URL shape",
      status: "invalid",
      detail:
        "The configured URL is not an absolute https endpoint (loopback http is allowed locally) or embeds credentials.",
    }
  }
  return {
    id: "crm-url:shape",
    label: "CRM webhook URL shape",
    status: "present",
    detail: "The configured URL is a valid https (or loopback) endpoint without embedded credentials.",
  }
}

function migrationCheck(presentFiles: readonly string[], file: string): PilotCheck {
  const present = presentFiles.includes(file)
  return {
    id: `migration:${file.split("/").pop()}`,
    label: file,
    status: present ? "unverified" : "missing",
    detail: present
      ? "Present locally; NOT applied anywhere. A staging apply + sign-off is required (B1/B2)."
      : "Migration file is missing from the repository.",
  }
}

export function buildPilotReadinessReport(input: PilotReadinessInput): PilotReadinessReport {
  const checks: PilotCheck[] = [
    envCheck(input.env, "REPLYFLOW_LEAD_INTAKE_SECRET"),
    envCheck(input.env, "REPLYFLOW_CRM_WEBHOOK_URL"),
    envCheck(input.env, "REPLYFLOW_CRM_WEBHOOK_SECRET"),
    envCheck(input.env, "NEXT_PUBLIC_SUPABASE_URL"),
    envCheck(input.env, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    envCheck(input.env, "SUPABASE_SERVICE_ROLE_KEY"),
    crmUrlCheck(input.env),
    ...PILOT_MIGRATION_FILES.map((file) => migrationCheck(input.presentFiles, file)),
    {
      id: "staging:e2e",
      label: "Staging end-to-end dry-run",
      status: "unverified",
      detail:
        "Not checkable locally. Needs B1/B2 (staging backup + migrations applied) and a signed delivery to a staging CRM endpoint.",
    },
    {
      id: "commercial:pricing",
      label: "Pilot pricing decision",
      status: "unverified",
      detail: "CEO-owned (B6). No price is recorded in the repository, so none is reported.",
    },
    {
      id: "demo:local-mock",
      label: "Mock-backed local demo",
      status: "present",
      detail:
        "`npm run demo:lead-capture` runs the real orchestration against in-memory fakes and a mock CRM. No network, no credentials.",
    },
  ]

  const summary = {
    present: checks.filter((c) => c.status === "present").length,
    missing: checks.filter((c) => c.status === "missing").length,
    invalid: checks.filter((c) => c.status === "invalid").length,
    unverified: checks.filter((c) => c.status === "unverified").length,
    total: checks.length,
  }

  const blocked = summary.missing > 0 || summary.invalid > 0

  return {
    checks,
    summary,
    verdict: blocked ? "NOT READY" : "STAGING VERIFICATION REQUIRED",
    demoCapable: true,
  }
}
