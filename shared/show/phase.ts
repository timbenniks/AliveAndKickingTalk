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
