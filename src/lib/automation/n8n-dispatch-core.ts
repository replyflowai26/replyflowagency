// Pure core of the ReplyFlow → n8n webhook dispatch. Dependency-free so the
// request/response handling can be unit-tested deterministically with an
// injected fetch substitute. The server-only adapter (n8n.ts) supplies the
// configured base URL and the real fetch binding.

import { buildN8nWebhookUrl } from "./webhook"

export type N8nDispatchRequest = {
  workflowId: string
  runId: string
  organizationId: string
  webhookPath: string
  input: Record<string, unknown>
}

export type N8nDispatchSuccess = {
  ok: true
}

export type N8nDispatchFailure = {
  ok: false
  reason: "not_configured" | "invalid_webhook" | "http_error" | "not_registered" | "network"
  status?: number
}

export type N8nDispatchResult = N8nDispatchSuccess | N8nDispatchFailure

export type N8nWebhookResponseClassification =
  | { kind: "accepted" }
  | { kind: "not_registered"; status: number }
  | { kind: "http_error"; status: number }

export type N8nDispatchHttpDeps = {
  fetchImpl: typeof fetch
}

// n8n answers unmatched production webhook requests with an intentional HTTP
// 404 whose JSON body states the webhook is not registered (the workflow is
// inactive, in test mode, or the path does not match). Classifying that exact
// signature is what lets the caller tell "workflow not registered" apart from
// a generic HTTP rejection. A 404 without the signature stays a generic error;
// other statuses are never treated as registration issues.
export function isN8nWebhookNotRegisteredBody(
  bodyText: string | null | undefined,
): boolean {
  if (typeof bodyText !== "string") return false
  const text = bodyText.slice(0, 4096)
  return /"code"\s*:\s*404/.test(text) && /not\s+registered/i.test(text)
}

export function classifyN8nWebhookResponse(
  status: number,
  bodyText: string | null | undefined,
): N8nWebhookResponseClassification {
  if (status >= 200 && status < 300) return { kind: "accepted" }
  if (status === 404 && isN8nWebhookNotRegisteredBody(bodyText)) {
    return { kind: "not_registered", status }
  }
  return { kind: "http_error", status }
}

/**
 * Dispatch to the configured n8n base URL over the injected fetch. Returns a
 * typed result; it never throws on transport/HTTP failures so callers can
 * update the durable run record with a consistent outcome.
 */
export async function dispatchN8nWebhookRequest(
  request: N8nDispatchRequest,
  baseUrl: string,
  deps: N8nDispatchHttpDeps,
): Promise<N8nDispatchResult> {
  const url = buildN8nWebhookUrl(baseUrl, request.webhookPath)
  if (!url) {
    return { ok: false, reason: "invalid_webhook" }
  }

  const payload = {
    replyflow_run_id: request.runId,
    organization_id: request.organizationId,
    workflow_id: request.workflowId,
    input: request.input ?? {},
  }

  let response: Response
  try {
    response = await deps.fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    })
  } catch {
    // A transport failure (DNS, refused, reset, timeout) is ambiguous: n8n
    // may or may not have started the workflow. The caller keeps the run
    // `running` so the recovery/callback path reconciles without re-dispatching.
    return { ok: false, reason: "network" }
  }

  const bodyText = await response.text().catch(() => "")
  const classification = classifyN8nWebhookResponse(response.status, bodyText)

  if (classification.kind === "accepted") {
    return { ok: true }
  }

  return {
    ok: false,
    reason: classification.kind === "not_registered" ? "not_registered" : "http_error",
    status: response.status,
  }
}