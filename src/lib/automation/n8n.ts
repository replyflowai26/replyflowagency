import "server-only"

import {
  dispatchN8nWebhookRequest,
  type N8nDispatchRequest,
} from "@/lib/automation/n8n-dispatch-core"

export type { N8nDispatchRequest }

export type N8nDispatchSuccess = {
  ok: true
}

export type N8nDispatchFailure = {
  ok: false
  reason: "not_configured" | "invalid_webhook" | "http_error" | "not_registered" | "network"
  status?: number
}

export type N8nDispatchResult = N8nDispatchSuccess | N8nDispatchFailure

function getConfig() {
  const baseUrl = process.env.N8N_BASE_URL?.replace(/\/+$/, "")
  if (!baseUrl) throw new Error("n8n integration is not configured.")
  return { baseUrl }
}

/**
 * Dispatch a workflow run to n8n's public webhook.
 *
 * This intentionally does NOT use n8n's internal Execution API. The webhook
 * trigger is the production dispatch mechanism: n8n starts the workflow
 * asynchronously and the workflow is responsible for calling ReplyFlow's
 * callback endpoint with the final result.
 *
 * Because a webhook dispatch is fire-and-forget, a 2xx here only means n8n
 * accepted the request — it does NOT mean the workflow succeeded. Callers must
 * treat a successful dispatch as "running" and wait for the callback.
 *
 * Only the minimum required data is sent: the ReplyFlow run/organization ids
 * and the run input. No credentials, service keys or unrelated user data are
 * ever included.
 */
export async function dispatchToN8nWebhook(
  request: N8nDispatchRequest,
): Promise<N8nDispatchResult> {
  let baseUrl: string
  try {
    baseUrl = getConfig().baseUrl
  } catch {
    return { ok: false, reason: "not_configured" }
  }

  return dispatchN8nWebhookRequest(request, baseUrl, { fetchImpl: fetch })
}