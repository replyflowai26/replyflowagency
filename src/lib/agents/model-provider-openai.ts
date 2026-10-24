// Real, OPT-IN language-model adapter for the agent runtime.
//
// It speaks the OpenAI-compatible "chat completions" wire format, which is also
// offered by many other providers. Nothing in this file is used by default: the
// runtime default remains the deterministic planner in `model-adapter.ts`. This
// adapter is selected ONLY when its configuration environment variables are
// present (see `resolveAgentModelAdapter`).
//
// Safety / design contract:
// - No provider URL is hard-coded. The base URL comes from configuration
//   (REPLYFLOW_AI_BASE_URL), so this works with any compatible provider and a
//   reviewer can see exactly what is contacted.
// - The API key is read from the environment and sent ONLY in the Authorization
//   header. It is never placed in a prompt, a log line, or an error message.
// - Every request is bounded by an AbortController timeout and retried with
//   capped exponential backoff. 4xx responses are not retried.
// - The model's answer is treated as UNTRUSTED. `parseModelPlan`:
//     * accepts only tools that are already on the allowlist (others are dropped),
//     * ignores any step ids the model invents (we assign our own),
//     * DERIVES `consequential` from the tool registry, never from the model.
//   The orchestrator also re-sanitises the plan before persisting it.
// - `fetchFn` and `sleep` are injectable so tests never reach the network.
//
// This module deliberately does NOT import "server-only": it must be importable
// by the bridge-compiled test suite. It is still server-only by construction —
// it is never referenced from client code and reads only process.env.

import {
  AGENT_OBJECTIVE_MAX_LENGTH,
  validateObjective,
  type AgentPlanInput,
} from "./planner-core"
import {
  createDeterministicModelAdapter,
  createUnavailableModelAdapter,
  type AgentModelAdapter,
} from "./model-adapter"
import { isAllowlistedTool, isConsequentialTool, AGENT_TOOL_IDS } from "./tools"
import {
  AGENT_TASK_CATEGORIES,
  type AgentPlan,
  type AgentPlanStep,
  type AgentTaskCategory,
} from "./types"

// ─── Configuration ───────────────────────────────────────────────────────────

export const AI_API_KEY_ENV = "REPLYFLOW_AI_API_KEY"
export const AI_BASE_URL_ENV = "REPLYFLOW_AI_BASE_URL"
export const AI_MODEL_ENV = "REPLYFLOW_AI_MODEL"
export const AI_TIMEOUT_MS_ENV = "REPLYFLOW_AI_TIMEOUT_MS"
export const AI_MAX_RETRIES_ENV = "REPLYFLOW_AI_MAX_RETRIES"

export const DEFAULT_AI_TIMEOUT_MS = 20000
export const DEFAULT_AI_MAX_RETRIES = 2
export const DEFAULT_AI_BACKOFF_MS = 500
export const MAX_AI_BACKOFF_MS = 4000
export const MAX_AI_STEPS = 8
export const MAX_AI_STEP_DESCRIPTION = 200

export type AiModelConfig = {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
  maxRetries: number
  /** Injected in tests; defaults to the global fetch. */
  fetchFn?: typeof fetch
  /** Injected in tests to make retry backoff deterministic. */
  sleep?: (ms: number) => Promise<void>
}

export type AiConfigResult =
  | { ok: true; config: AiModelConfig }
  | { ok: false; reason: string }

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

function parseIntEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "string" || value.trim() === "") return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return clamp(parsed, min, max)
}

/**
 * Validate and normalise a base URL. Only absolute https URLs are accepted;
 * http is allowed only for loopback hosts so a local development provider can be
 * used without weakening production transport security. URLs with embedded
 * credentials are rejected so a secret can never be smuggled through the URL.
 */
export function normalizeBaseUrl(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]"
  if (url.protocol === "https:") {
    // ok
  } else if (url.protocol === "http:" && isLoopback) {
    // ok: local development only
  } else {
    return null
  }
  const path = url.pathname.replace(/\/+$/, "")
  return `${url.protocol}//${url.host}${path}`
}

/**
 * Parse model configuration from an environment object. Returns a discriminated
 * union; the failure `reason` never contains a secret, only the missing/again
 * invalid variable name.
 */
export function parseAiModelConfig(env: Record<string, string | undefined> = process.env): AiConfigResult {
  const apiKey = (env[AI_API_KEY_ENV] ?? "").trim()
  const rawBaseUrl = (env[AI_BASE_URL_ENV] ?? "").trim()
  const model = (env[AI_MODEL_ENV] ?? "").trim()

  if (!apiKey) return { ok: false, reason: `${AI_API_KEY_ENV} is not set` }
  if (!rawBaseUrl) return { ok: false, reason: `${AI_BASE_URL_ENV} is not set` }
  if (!model) return { ok: false, reason: `${AI_MODEL_ENV} is not set` }

  const baseUrl = normalizeBaseUrl(rawBaseUrl)
  if (baseUrl === null) {
    return {
      ok: false,
      reason: `${AI_BASE_URL_ENV} must be an absolute https URL (http is allowed only for loopback) without embedded credentials`,
    }
  }

  return {
    ok: true,
    config: {
      apiKey,
      baseUrl,
      model,
      timeoutMs: parseIntEnv(env[AI_TIMEOUT_MS_ENV], DEFAULT_AI_TIMEOUT_MS, 1000, 120000),
      maxRetries: parseIntEnv(env[AI_MAX_RETRIES_ENV], DEFAULT_AI_MAX_RETRIES, 0, 5),
    },
  }
}

// ─── Prompt construction ─────────────────────────────────────────────────────

export type ChatMessage = { role: "system" | "user"; content: string }

const TOOL_ALLOWLIST = AGENT_TOOL_IDS.join(", ")
const CATEGORY_ALLOWLIST = AGENT_TASK_CATEGORIES.join(", ")

/**
 * Build the chat messages for a planning request. The prompt contains ONLY the
 * objective and static instructions: no API key, no environment values, and no
 * customer data beyond the objective the caller already supplied.
 */
export function buildPlanMessages(objective: string): ChatMessage[] {
  const system = [
    "You are the planning module of a business operations assistant.",
    "You do not execute anything; you only produce a reviewable plan.",
    "Respond with a SINGLE JSON object and nothing else, of the form:",
    '{"category":"<category>","summary":"<one sentence>","steps":[{"tool":"<tool id>","description":"<short>"}]}',
    `category must be one of: ${CATEGORY_ALLOWLIST}.`,
    `tool must be one of: ${TOOL_ALLOWLIST}.`,
    `Use at most ${MAX_AI_STEPS} steps, only as many as are necessary.`,
    "Never include secrets, credentials, API keys or personal data in any field.",
    "Do not invent tools or steps outside the allowlist.",
  ].join("\n")

  const user = `Objective: ${objective.slice(0, AGENT_OBJECTIVE_MAX_LENGTH)}`

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ]
}

// ─── Untrusted answer parsing ────────────────────────────────────────────────

export type ParsedModelPlan =
  | { ok: true; plan: AgentPlan }
  | { ok: false; reason: "invalid"; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function clampText(value: string, max: number): string {
  const trimmed = value.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

// Strip ```json … ``` fences some models add despite instructions.
function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fence = /^```[a-zA-Z]*\n([\s\S]*?)\n```$/
  const match = trimmed.match(fence)
  return match ? match[1].trim() : trimmed
}

/**
 * Convert an untrusted model answer into a valid, safe AgentPlan.
 *
 * Accepts either an already-parsed object or a JSON string. Every step is forced
 * through the tool allowlist; `consequential` is derived from the registry; step
 * ids are ours. Returns `invalid` when there are no usable steps.
 */
export function parseModelPlan(raw: unknown, _objective: string): ParsedModelPlan {
  let value: unknown = raw
  if (typeof raw === "string") {
    if (raw.trim() === "") return { ok: false, reason: "invalid", message: "Model returned an empty answer." }
    try {
      value = JSON.parse(stripCodeFences(raw))
    } catch {
      return { ok: false, reason: "invalid", message: "Model answer was not valid JSON." }
    }
  }
  if (!isRecord(value)) {
    return { ok: false, reason: "invalid", message: "Model answer was not a JSON object." }
  }

  const warnings: string[] = ["Plan generated by a language model; tools were allowlist-checked."]

  const rawCategory = typeof value.category === "string" ? value.category.trim() : ""
  const category: AgentTaskCategory = (AGENT_TASK_CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as AgentTaskCategory)
    : "general"
  if (rawCategory && category === "general" && rawCategory !== "general") {
    warnings.push(`Unknown category "${clampText(rawCategory, 40)}" was mapped to "general".`)
  }

  const rawSteps = Array.isArray(value.steps) ? value.steps : []
  if (rawSteps.length === 0) {
    return { ok: false, reason: "invalid", message: "Model returned no steps." }
  }

  const steps: AgentPlanStep[] = []
  let dropped = 0
  for (const entry of rawSteps.slice(0, MAX_AI_STEPS)) {
    if (!isRecord(entry)) {
      dropped += 1
      continue
    }
    const tool = typeof entry.tool === "string" ? entry.tool.trim() : ""
    if (!isAllowlistedTool(tool)) {
      // The model may only select tools we already declared.
      dropped += 1
      continue
    }
    const index = steps.length
    const description =
      typeof entry.description === "string" && entry.description.trim()
        ? clampText(entry.description, MAX_AI_STEP_DESCRIPTION)
        : `Run ${tool}.`
    steps.push({
      id: `step-${index + 1}`,
      tool,
      description,
      // Derived from the registry — the model's own claim is ignored.
      consequential: isConsequentialTool(tool),
      dependsOn: index === 0 ? [] : [`step-${index}`],
    })
  }

  if (dropped > 0) warnings.push(`${dropped} unusable or non-allowlisted step(s) were dropped.`)
  if (steps.length === 0) {
    return { ok: false, reason: "invalid", message: "Model returned no allowlisted steps." }
  }

  const summary =
    typeof value.summary === "string" && value.summary.trim()
      ? clampText(value.summary, 200)
      : `Plan (${category}): ${steps.length} step(s).`

  const plan: AgentPlan = {
    category,
    summary,
    steps,
    requiresApproval: steps.some((step) => step.consequential),
    deterministic: false,
    warnings,
  }

  // `_objective` is accepted for parity/future use; the shape does not depend on it.
  return { ok: true, plan }
}

// ─── HTTP adapter ─────────────────────────────────────────────────────────────

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Extract choices[0].message.content without trusting the surrounding shape.
function readMessageContent(body: unknown): string | null {
  if (!isRecord(body)) return null
  const choices = body.choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0]
  if (!isRecord(first)) return null
  const message = first.message
  if (!isRecord(message)) return null
  const content = message.content
  return typeof content === "string" ? content : null
}

/**
 * Build an OpenAI-compatible planning adapter.
 *
 * Reliability contract:
 * - Every attempt is bounded by an AbortController timeout.
 * - 5xx responses, timeouts and network errors are retried with capped
 *   exponential backoff, then reported as `model_error` (never a fake success).
 * - 4xx responses are NOT retried (the request is wrong).
 * - A malformed or unsafe answer is reported as `invalid`.
 * - The API key appears ONLY in the Authorization header and never in an error.
 */
export function createOpenAiCompatibleModelAdapter(config: AiModelConfig): AgentModelAdapter {
  const timeoutMs = clamp(config.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS, 1000, 120000)
  const maxRetries = clamp(config.maxRetries ?? DEFAULT_AI_MAX_RETRIES, 0, 5)
  const doFetch = config.fetchFn ?? fetch
  const sleep = config.sleep ?? defaultSleep
  const endpoint = `${config.baseUrl}/chat/completions`
  const ref = `openai-compatible:${config.model}`

  return {
    ref,
    isDeterministic: false,
    async plan(request: AgentPlanInput) {
      const validation = validateObjective(request.objective)
      if (!validation.ok) {
        return { ok: false, reason: "invalid", message: validation.errors.join("; ") }
      }

      const body = JSON.stringify({
        model: config.model,
        messages: buildPlanMessages(validation.objective),
        temperature: 0,
        response_format: { type: "json_object" },
      })

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
          const response = await doFetch(endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${config.apiKey}`,
            },
            body,
            signal: controller.signal,
          })

          if (response.status >= 400 && response.status < 500) {
            // A client error will not succeed on retry, and the body may contain
            // provider diagnostics we do not want to surface or log.
            return {
              ok: false,
              reason: "model_error",
              message: `Model request was rejected (HTTP ${response.status}).`,
            }
          }

          if (!response.ok) {
            // 5xx: retryable, fall through to the backoff below.
            continue
          }

          let json: unknown
          try {
            json = await response.json()
          } catch {
            return { ok: false, reason: "invalid", message: "Model response was not valid JSON." }
          }

          const content = readMessageContent(json)
          if (content === null) {
            return { ok: false, reason: "invalid", message: "Model response had no message content." }
          }

          const parsed = parseModelPlan(content, validation.objective)
          if (!parsed.ok) return parsed
          return { ok: true, plan: parsed.plan, modelRef: ref }
        } catch {
          // Timeout or network error: retryable, fall through to the backoff.
        } finally {
          clearTimeout(timer)
        }

        if (attempt < maxRetries) {
          const backoff = Math.min(MAX_AI_BACKOFF_MS, DEFAULT_AI_BACKOFF_MS * 2 ** attempt)
          await sleep(backoff)
        }
      }

      return {
        ok: false,
        reason: "model_error",
        message: "Model request failed after retries.",
      }
    },
  }
}

// ─── Selection ────────────────────────────────────────────────────────────────

/**
 * Choose the model adapter from the environment.
 *
 * - No AI configuration at all  → the deterministic planner (today's default;
 *   it is clearly labelled `deterministic-planner-v1` and never claims to be an
 *   LLM).
 * - Partial/invalid configuration → an adapter that fails honestly, so a
 *   half-configured deployment cannot masquerade as a working model.
 * - Complete configuration       → the real OpenAI-compatible adapter.
 */
export function resolveAgentModelAdapter(
  env: Record<string, string | undefined> = process.env,
  overrides: { fetchFn?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {},
): AgentModelAdapter {
  const configured = [AI_API_KEY_ENV, AI_BASE_URL_ENV, AI_MODEL_ENV].some(
    (key) => (env[key] ?? "").trim() !== "",
  )
  if (!configured) return createDeterministicModelAdapter()

  const parsed = parseAiModelConfig(env)
  if (!parsed.ok) {
    return createUnavailableModelAdapter(`AI model configuration is invalid: ${parsed.reason}.`)
  }
  return createOpenAiCompatibleModelAdapter({ ...parsed.config, ...overrides })
}

// Re-export the deterministic factory so callers can compose fallbacks.
export { createDeterministicModelAdapter }
