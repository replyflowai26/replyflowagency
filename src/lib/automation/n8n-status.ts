import "server-only"

export type N8nExecutionStatus = {
  status: string
  finished: boolean
}

function getConfig() {
  const baseUrl = process.env.N8N_BASE_URL?.replace(/\/+$/, "")
  const apiKey = process.env.N8N_API_KEY
  if (!baseUrl || !apiKey) throw new Error("n8n integration is not configured.")
  return { baseUrl, apiKey }
}

const STATUS_FINISHED = new Set(["success", "error", "cancelled"])

/**
 * Best-effort read of an n8n execution outcome.
 *
 * This is a READ-ONLY reconciliation query used by recovery. It is distinct
 * from dispatch: recovery uses this only to learn the true terminal state of an
 * execution that is already known to exist, and never to start a new one.
 * Returns null when the execution cannot be read or has not finished.
 */
export async function getN8nExecutionStatus(
  executionId: string | null | undefined,
): Promise<N8nExecutionStatus | null> {
  if (typeof executionId !== "string" || !executionId.trim()) return null

  let baseUrl: string
  let apiKey: string
  try {
    const config = getConfig()
    baseUrl = config.baseUrl
    apiKey = config.apiKey
  } catch {
    return null
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/executions/${encodeURIComponent(executionId)}`, {
      headers: { "X-N8N-API-KEY": apiKey },
      cache: "no-store",
    })
    if (!response.ok) return null
    const data = (await response.json()) as { status?: unknown }
    const status = typeof data.status === "string" ? data.status : ""
    return { status, finished: STATUS_FINISHED.has(status) }
  } catch {
    return null
  }
}
