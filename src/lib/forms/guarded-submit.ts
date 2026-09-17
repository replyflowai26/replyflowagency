// Pure guarded submit wrapper.
//
// Guarantees a "saving" state is always cleared after a server action settles,
// regardless of whether the action resolves successfully, resolves with an
// error state, or throws. Dependency-free so it can be unit tested directly.

export type ClientSaveState = { error?: string; success?: string }

export type GuardedSubmitOptions<TState> = {
  execute: () => Promise<TState>
  onResolved: (state: TState) => void
  onRejected: (fallback: TState) => void
  onSettled: () => void
  errorMessage?: string
}

export function fallbackErrorState<TState extends { error?: string }>(message: string): TState {
  return { error: message } as TState
}

export async function runGuardedSubmit<TState extends { error?: string }>(
  options: GuardedSubmitOptions<TState>,
): Promise<TState> {
  try {
    const next = await options.execute()
    options.onResolved(next)
    return next
  } catch {
    const fallback = fallbackErrorState<TState>(
      options.errorMessage ?? "Unable to save. Please try again.",
    )
    options.onRejected(fallback)
    return fallback
  } finally {
    options.onSettled()
  }
}