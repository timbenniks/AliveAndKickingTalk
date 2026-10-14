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

type Title = Extract<StageMoment, { kind: 'title' }>

const listeners = new Set<Listener>()
// The last title, so a screen that mounts a moment late (the 3D scene loads
// after the page) can still show what is meant to be on it.
let lastTitle: { moment: Title, at: number } | null = null

export function emitMoment(moment: StageMoment, now = Date.now()) {
  if (moment.kind === 'title') lastTitle = { moment, at: now }
  for (const listener of [...listeners]) listener(moment)
}

// The title still on screen at `now`, with only its remaining seconds.
export function recentTitle(now = Date.now()): Title | null {
  if (!lastTitle) return null
  const left = lastTitle.moment.seconds - (now - lastTitle.at) / 1000
  return left > 0.25 ? { ...lastTitle.moment, seconds: left } : null
}

export function onMoment(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
