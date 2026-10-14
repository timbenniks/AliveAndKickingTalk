// The show phase lives in the config row 'show_phase' so only the host can
// change it: 'idle', 'playing', or 'encore:<endsAt ISO>'.

export type ShowPhase = { kind: 'idle' } | { kind: 'playing' } | { kind: 'encore'; endsAt: number }

export function parseShowPhase(value: string | null | undefined): ShowPhase {
  if (value === 'playing') return { kind: 'playing' }
  if (value?.startsWith('encore:')) {
    const endsAt = Date.parse(value.slice('encore:'.length))
    if (Number.isFinite(endsAt)) return { kind: 'encore', endsAt }
  }
  return { kind: 'idle' }
}

export function formatShowPhase(phase: ShowPhase) {
  return phase.kind === 'encore' ? `encore:${new Date(phase.endsAt).toISOString()}` : phase.kind
}

// Driven by the stage clock: one write at a time, retry failed writes after
// two seconds, and always send the latest phase rather than a stale retry.
export function createShowPhaseSync(write: (phase: ShowPhase) => Promise<boolean>, onFailure: (failed: boolean) => void) {
  let confirmed = ''
  let desired = ''
  let retryAt = 0
  let now = 0
  let pending: Promise<void> | null = null
  let stopped = false

  async function save(phase: ShowPhase, key: string) {
    let saved = false
    try { saved = await write(phase) } catch { /* Retried by the next eligible tick. */ }
    if (stopped) return
    if (saved) confirmed = key
    else if (key === desired) retryAt = now + 2000
    if (key === desired) onFailure(!saved)
  }

  return {
    tick(phase: ShowPhase, time: number) {
      if (stopped) return
      now = time
      const key = formatShowPhase(phase)
      if (key !== desired) { desired = key; retryAt = 0 }
      if (pending) return
      if (key === confirmed) { onFailure(false); return }
      if (now < retryAt) return
      pending = save(phase, key).finally(() => { pending = null })
    },
    // Let teardown wait for an in-flight write before publishing the final idle.
    stop() {
      stopped = true
      return pending ?? Promise.resolve()
    },
  }
}
