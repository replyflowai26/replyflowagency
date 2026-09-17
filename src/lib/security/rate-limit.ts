import "server-only"

// Minimal, dependency-free in-memory sliding-window rate limiter.
//
// This is a per-instance (per-function-server) guard. It is not a distributed
// limiter: on serverless deployments with multiple concurrent instances each
// instance keeps its own window. For single-instance Node hosting it provides a
// reliable defense against accidental or malicious bursts on high-risk routes.
// Because it is intentionally small and guarded it never throws into the caller
// and degrades to "allow" if the clock or storage ever misbehaves (fail-open is
// acceptable here only because strong authentication is enforced separately).

type RateLimitWindow = {
  limit: number
  windowMs: number
  timestamps: number[]
  lastSweptAt: number
}

type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterSeconds: number
}

// Storage is injectable so tests can use a fresh Map per run without globals.
export type RateLimitStorage = {
  get(key: string): RateLimitWindow | undefined
  set(key: string, window: RateLimitWindow): void
  delete(key: string): void
}

export const inMemoryRateLimitStorage: RateLimitStorage = {
  get(key) {
    return rateLimitBuckets.get(key)
  },
  set(key, window) {
    rateLimitBuckets.set(key, window)
  },
  delete(key) {
    rateLimitBuckets.delete(key)
  },
}

const rateLimitBuckets = new Map<string, RateLimitWindow>()

function now(): number {
  return Date.now()
}

function sweepWindow(window: RateLimitWindow): void {
  const cutoff = now() - window.windowMs
  window.timestamps = window.timestamps.filter((ts) => ts > cutoff)
  window.lastSweptAt = now()
}

// The bucket map grows without bound only under sustained distinct-key traffic
// with a long window. Periodic pruning keeps memory bounded.
let lastGlobalSweep = Date.now()

function sweepBuckets(): void {
  const elapsed = now() - lastGlobalSweep
  if (elapsed < 60_000) return
  lastGlobalSweep = now()
  for (const [key, window] of rateLimitBuckets.entries()) {
    sweepWindow(window)
    if (window.timestamps.length === 0) {
      rateLimitBuckets.delete(key)
    }
  }
}

/**
 * Enforce a sliding-window rate limit for `key`.
 * Returns whether the call is allowed plus the standard headers' values.
 * Never throws; on internal failure it fails open (`allowed: true`).
 */
export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number } = { limit: 20, windowMs: 60_000 },
  storage: RateLimitStorage = inMemoryRateLimitStorage,
): RateLimitResult {
  try {
    const { limit, windowMs } = options
    const safeLimit = Math.max(1, Math.floor(limit))
    const safeWindow = Math.max(1000, Math.floor(windowMs))

    sweepBuckets()

    let window = storage.get(key)
    if (!window) {
      window = { limit: safeLimit, windowMs: safeWindow, timestamps: [], lastSweptAt: now() }
      storage.set(key, window)
    }
    sweepWindow(window)

    const oldestAllowed = now() - safeWindow
    window.timestamps = window.timestamps.filter((ts) => ts > oldestAllowed)

    if (window.timestamps.length >= safeLimit) {
      const oldest = window.timestamps[0] ?? now()
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldest + safeWindow - now()) / 1000),
      )
      return {
        allowed: false,
        limit: safeLimit,
        remaining: 0,
        retryAfterSeconds,
      }
    }

    window.timestamps.push(now())
    storage.set(key, window)

    return {
      allowed: true,
      limit: safeLimit,
      remaining: Math.max(0, safeLimit - window.timestamps.length),
      retryAfterSeconds: 0,
    }
  } catch {
    return { allowed: true, limit: options.limit, remaining: 1, retryAfterSeconds: 0 }
  }
}
