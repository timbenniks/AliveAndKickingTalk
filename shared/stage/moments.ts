// Show moments: one-off events (pyro, a crowd surf, a title on the LED wall)
// that any part of the app can fire and any 3D component can react to. Each
// listener decides for itself whether reduced motion skips it.

export type StageMoment =
  | { kind: 'pyro' }
  | { kind: 'confetti' }
  | { kind: 'jump' }
  | { kind: 'surf' }
  | { kind: 'intro' }
  | { kind: 'title', lines: string[], seconds: number, color?: string }

type Listener = (moment: StageMoment) => void

const listeners = new Set<Listener>()

export function emitMoment(moment: StageMoment) {
  for (const listener of [...listeners]) listener(moment)
}

export function onMoment(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
