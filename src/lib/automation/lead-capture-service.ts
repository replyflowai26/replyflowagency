import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  createHttpCrmAdapter,
  createUnconfiguredIntegrationAdapter,
  normalizeCrmWebhookUrl,
  type NotificationAdapter,
} from "@/lib/automation/integration-adapter"
import { logError, logEvent } from "@/lib/telemetry/logging"
import {
  decideLeadApproval,
  handleInboundLead,
  type LeadApprovalOutcome,
  type LeadCaptureContext,
  type LeadCaptureOutcome,
} from "@/lib/automation/lead-capture-run"

// Production wiring for the lead-capture orchestrator.
//
// This module supplies the real Supabase admin client and a structured logger.
// Execution still happens on the EXISTING runtime: this only creates the durable
// `workflow_runs` record and its event timeline. n8n dispatch and callback
// reconciliation remain in execution-service.ts / the callback route.
//
// External integrations: there is intentionally NO default real adapter. A real
// outbound CRM adapter is selected ONLY when it is explicitly configured via the
// environment (see resolveIntegrationAdapter). Otherwise the unconfigured
// adapter is used, which fails honestly and marks the run failed rather than
// pretending a delivery happened.

/** URL of a customer-owned CRM webhook that accepts signed lead deliveries. */
export const CRM_WEBHOOK_URL_ENV = "REPLYFLOW_CRM_WEBHOOK_URL"
/** Shared secret used to HMAC-sign CRM deliveries. */
export const CRM_WEBHOOK_SECRET_ENV = "REPLYFLOW_CRM_WEBHOOK_SECRET"

function defaultLogger() {
  return (
    level: "error" | "warn" | "info",
    scope: string,
    message: string,
    error?: unknown,
    meta?: Record<string, unknown>,
  ) => {
    if (level === "error") {
      logError(scope, message, error instanceof Error ? error : undefined, meta)
    } else {
      logEvent(level === "warn" ? "warn" : "info", scope, message, meta)
    }
  }
}

/**
 * Select the outbound integration adapter from configuration.
 *
 * Returns the real HTTP CRM adapter only when BOTH the webhook URL and the
 * signing secret are present; otherwise it returns the unconfigured adapter,
 * which fails honestly. This keeps a misconfigured or unconfigured deployment
 * from ever claiming a delivery it did not make.
 */
export function resolveIntegrationAdapter(
  env: NodeJS.ProcessEnv = process.env,
): NotificationAdapter {
  const url = env[CRM_WEBHOOK_URL_ENV]?.trim()
  const secret = env[CRM_WEBHOOK_SECRET_ENV]?.trim()
  if (url && secret) {
    const normalized = normalizeCrmWebhookUrl(url)
    if (normalized) {
      return createHttpCrmAdapter({ url: normalized, secret })
    }
    // A configured-but-insecure URL must not silently become a plaintext
    // delivery: fail honestly and surface the misconfiguration in the logs.
    logEvent("warn", "automation.lead-capture", "CRM webhook URL is insecure or malformed; refusing to deliver.", {
      env: CRM_WEBHOOK_URL_ENV,
    })
  }
  return createUnconfiguredIntegrationAdapter()
}

export type StartLeadCaptureOptions = {
  adapter?: NotificationAdapter
}

/**
 * Validate, qualify and enqueue an inbound lead onto the durable run pipeline.
 * Returns the orchestrator outcome. Does not dispatch to n8n.
 */
export async function startLeadCaptureRun(
  raw: unknown,
  context: LeadCaptureContext,
  options: StartLeadCaptureOptions = {},
): Promise<LeadCaptureOutcome> {
  const supabase = createAdminClient()
  return handleInboundLead(raw, context, {
    supabase,
    notify: options.adapter ?? resolveIntegrationAdapter(),
    log: defaultLogger(),
  })
}

/**
 * Resolve a pending approval gate for a hot lead (approve or reject).
 */
export async function resolveLeadApproval(
  runId: string,
  decision: "approved" | "rejected",
  context: LeadCaptureContext,
  options: StartLeadCaptureOptions = {},
): Promise<LeadApprovalOutcome> {
  const supabase = createAdminClient()
  return decideLeadApproval(runId, decision, context, {
    supabase,
    notify: options.adapter ?? resolveIntegrationAdapter(),
    log: defaultLogger(),
  })
}
