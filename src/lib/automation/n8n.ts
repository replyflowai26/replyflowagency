import "server-only"

export type N8nExecutionRequest = {
  workflowId: string
  runId: string
  organizationId: string
  input: Record<string, unknown>
}

export type N8nExecutionResponse = {
  externalExecutionId: string
}

function getConfig() {
  const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, "")
  const apiKey = process.env.N8N_API_KEY
  if (!baseUrl || !apiKey) throw new Error("n8n integration is not configured.")
  return { baseUrl, apiKey }
}

export async function triggerN8nExecution(request: N8nExecutionRequest): Promise<N8nExecutionResponse> {
  const { baseUrl, apiKey } = getConfig()
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
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`n8n execution request failed (${response.status})${body ? `: ${body.slice(0, 300)}` : ""}`)
  }

  const payload = (await response.json()) as { id?: string; executionId?: string }
  const externalExecutionId = payload.id ?? payload.executionId
  if (!externalExecutionId) throw new Error("n8n did not return an execution id.")

  return { externalExecutionId }
}
