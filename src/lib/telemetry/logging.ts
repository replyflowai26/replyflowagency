import "server-only"

// Minimal, dependency-free structured runtime logging.
//
// Goals:
// - Never throws or affects the primary operation (best-effort only).
// - Config-gated: enabled by default in non-development environments unless
//   explicitly disabled. Uses a static per-process flag so it is cheap.
// - Emits structured JSON on the server, making logs machine-parseable.
// - Explicitly avoids serializing raw values that may hold secrets (e.g.
//   Supabase credentials, form payloads). Callers opt-in to specific metadata.
//
// This intentionally does not add a logging dependency and does not require a
// schema change or new table.

const LOG_LEVEL = (process.env.LOG_LEVEL ?? "").toLowerCase()

const isEnabled =
  LOG_LEVEL !== "silent" &&
  process.env.NODE_ENV !== "development" &&
  process.env.LOG_RUNTIME !== "off"

type ErrorLike = { message?: string; name?: string; stack?: string } | null | undefined

function safeError(error: ErrorLike): { name?: string; message: string; stack?: string } {
  const message =
    error && typeof error.message === "string" && error.message.length
      ? error.message.slice(0, 2000)
      : "Unknown error."
  const name = error?.name ? String(error.name).slice(0, 200) : undefined
  const stack = error?.stack ? String(error.stack).slice(0, 4000) : undefined
  return { ...(name ? { name } : {}), message, ...(stack ? { stack } : {}) }
}

// Never allow arbitrary metadata from callers that could contain keys/secrets.
function safeMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {}
  const allowed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (/secret|key|token|password|credential|authorization/i.test(key)) continue
    allowed[key] =
      typeof value === "string"
        ? value.slice(0, 500)
        : typeof value === "object" && value !== null
          ? JSON.stringify(value, null, 0)?.slice(0, 1000)
          : value
  }
  return allowed
}

function emit(level: "error" | "warn" | "info", payload: Record<string, unknown>) {
  if (!isEnabled) return
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      runtime: "replyflow-ai",
      ...payload,
    })
    if (level === "error") {
      console.error(line)
    } else if (level === "warn") {
      console.warn(line)
    } else {
      console.log(line)
    }
  } catch {
    // Logging must never break the request.
  }
}

/**
 * Record a runtime error. Best-effort and non-fatal; safe to call in server
 * actions, route handlers, and error boundaries. Metadata keys that look like
 * secrets are dropped and all values are truncated.
 */
export function logError(
  scope: string,
  message: string,
  error?: ErrorLike,
  meta?: Record<string, unknown>,
) {
  emit("error", {
    scope: String(scope).slice(0, 200),
    message: String(message).slice(0, 2000),
    ...(error ? { error: safeError(error) } : {}),
    ...(meta ? { meta: safeMeta(meta) } : {}),
  })
}

/**
 * Record an informational/warning log event. Best-effort and non-fatal.
 */
export function logEvent(
  level: "info" | "warn",
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  emit(level, {
    scope: String(scope).slice(0, 200),
    message: String(message).slice(0, 2000),
    ...(meta ? { meta: safeMeta(meta) } : {}),
  })
}
