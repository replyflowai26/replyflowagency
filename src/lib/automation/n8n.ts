import "server-only"

export type N8nExecutionRequest = {
  workflowId: string
  runId: string
  organizationId: string
  input: Record<string, unknown>
}

export type N8nExecutionResponse = {
  externalExecutionId: string
  attempts: number
}

const MAX_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 15_000
const INITIAL_BACKOFF_MS = 500

function getConfig() {
  const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, "")
  const apiKey = process.env.N8N_API_KEY
  if (!baseUrl || !apiKey) throw new Error("n8n integration is not configured.")
  return { baseUrl, apiKey }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function getRetryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after")
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(retryAfterSeconds * 1000, 10_000)
  }

  return Math.min(INITIAL_BACKOFF_MS * 2 ** (attempt - 1), 4_000)
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function triggerN8nExecution(
  request: N8nExecutionRequest,
): Promise<N8nExecutionResponse> {
  const { baseUrl, apiKey } = getConfig()
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/executions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-N8N-API-KEY": apiKey,
          "Idempotency-Key": request.runId,
        },
        body: JSON.stringify({
          workflowId: request.workflowId,
          runId: request.runId,
          organizationId: request.organizationId,
          input: request.input,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => "")
        const message = `n8n execution request failed (${response.status})${body ? `: ${body.slice(0, 300)}` : ""}`

        if (!isRetryableStatus(response.status) || attempt === MAX_ATTEMPTS) {
          throw new Error(message)
        }

        await sleep(getRetryDelay(response, attempt))
        continue
      }

      const payload = (await response.json()) as {
        id?: string
        executionId?: string
      }
      const externalExecutionId = payload.id ?? payload.executionId

      if (!externalExecutionId) {
        throw new Error("n8n did not return an execution id.")
      }

      return { externalExecutionId, attempts: attempt }
    } catch (error) {
      lastError = error

      if (attempt === MAX_ATTEMPTS) break

      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        await sleep(INITIAL_BACKOFF_MS * 2 ** (attempt - 1))
        continue
      }

      if (error instanceof TypeError) {
        await sleep(INITIAL_BACKOFF_MS * 2 ** (attempt - 1))
        continue
      }

      throw error
    }
  }

  throw lastError instanceof Error
    ? new Error(`n8n execution request failed after ${MAX_ATTEMPTS} attempts: ${lastError.message}`)
    : new Error(`n8n execution request failed after ${MAX_ATTEMPTS} attempts.`)
}
