// Pure helpers for building a ReplyFlow → n8n webhook dispatch URL.
//
// n8n executes a workflow through its public webhook trigger. The URL is the
// configured base URL joined with the `/webhook/` segment and the workflow's
// stored `n8n_webhook_path`. This module is dependency-free so it can be unit
// tested directly and reused by the dispatch adapter.

// n8n webhook paths are relative URL segments (e.g. "replyflow-runtime-abc").
// We reject anything URL-hostile before it is embedded into a fetch URL.
export function isSafeN8nWebhookPath(path: string): boolean {
  if (typeof path !== "string") return false
  if (path.length < 1 || path.length > 300) return false
  // Webhook triggers typically look like "name-<slug>-<uuid>" but we accept a
  // conservative URL path segment: no query, no fragment, no scheme, no leading
  // slash and no traversal.
  return /^[a-zA-Z0-9][a-zA-Z0-9._~-]*$/.test(path)
}

/**
 * Build the absolute webhook URL n8n exposes for a workflow.
 * Returns null when the base URL or path is invalid so callers can fail safely
 * without ever POSTing to an attacker-controlled or malformed URL.
 */
export function buildN8nWebhookUrl(
  baseUrl: string | undefined,
  webhookPath: string | null | undefined,
): string | null {
  if (typeof baseUrl !== "string" || !baseUrl.trim()) return null
  if (typeof webhookPath !== "string" || !isSafeN8nWebhookPath(webhookPath)) {
    return null
  }

  const trimmedBase = baseUrl.trim().replace(/\/+$/, "")
  if (!/^https?:\/\/[^\s/]+\.[^\s/]+/.test(trimmedBase) && !/^https?:\/\/localhost(?::\d+)?$/.test(trimmedBase)) {
    // Reject malformed or non-http(s) bases to avoid SSRF-style requests to
    // internal schemes. localhost and host:port hosts are allowed.
    if (!/^https?:\/\/[^\s]+$/.test(trimmedBase)) return null
  }

  return `${trimmedBase}/webhook/${webhookPath}`
}

// ─── Workflow mapping input validation (pure, dependency-free) ───────────────

export const MAX_N8N_WORKFLOW_ID_LENGTH = 256
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type WorkflowMappingInput = {
  workflowId: string
  n8nWorkflowId: string
  n8nWebhookPath: string
}

export type WorkflowMappingParseResult =
  | { ok: true; value: WorkflowMappingInput }
  | { ok: false; error: string }

export function parseWorkflowMappingInput(input: {
  workflowId?: unknown
  n8nWorkflowId?: unknown
  n8nWebhookPath?: unknown
}): WorkflowMappingParseResult {
  const workflowId = typeof input?.workflowId === "string" ? input.workflowId.trim() : ""
  const n8nWorkflowId = typeof input?.n8nWorkflowId === "string" ? input.n8nWorkflowId.trim() : ""
  const n8nWebhookPath = typeof input?.n8nWebhookPath === "string" ? input.n8nWebhookPath.trim() : ""

  if (!UUID_RE.test(workflowId)) {
    return { ok: false, error: "Workflow reference is invalid." }
  }
  if (n8nWorkflowId.length < 1 || n8nWorkflowId.length > MAX_N8N_WORKFLOW_ID_LENGTH) {
    return { ok: false, error: "n8n workflow id must be between 1 and 256 characters." }
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._~-]*$/.test(n8nWorkflowId)) {
    return { ok: false, error: "n8n workflow id contains invalid characters." }
  }
  if (!isSafeN8nWebhookPath(n8nWebhookPath)) {
    return { ok: false, error: "Webhook path must be a relative n8n webhook path (no scheme, no leading slash, letters/digits/.,_~-)." }
  }
  return { ok: true, value: { workflowId, n8nWorkflowId, n8nWebhookPath } }
}
