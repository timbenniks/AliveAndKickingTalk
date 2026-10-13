export interface ThemeLook {
  id: string
  background: string
  primary: string
  secondary: string
  particles: number
  cameraShake: number
}

export const FALLBACK_THEME = 'neon-stadium'

const PRESET_THEMES: Record<string, string> = {
  'stadium rock': 'neon-stadium',
  'face bleeding solo': 'fire-solo',
  metal: 'metal-rig',
  "billie's thrash": 'punk-green',
  'thrash pop': 'pop-flash',
  'up the irons!': 'iron-march',
  'the troops': 'troop-gold',
  'phil x on fire': 'phil-ember',
  'sambora original': 'sambora-amber',
  "joe's funky tone": 'funky-magenta',
  'soaring lead': 'soaring-ice',
  "eddie's tone": 'eddie-rose',
  'chuck 2.0': 'chuck-cream',
  'boogie woogie': 'boogie-gold',
  'top hat solo': 'tophat-crimson',
}

export const themes: Record<string, ThemeLook> = {
  'neon-stadium': { id: 'neon-stadium', background: '#090c22', primary: '#3877ff', secondary: '#c23aff', particles: 0.45, cameraShake: 0.1 },
  'fire-solo': { id: 'fire-solo', background: '#23070b', primary: '#ff542b', secondary: '#ffcc42', particles: 0.95, cameraShake: 0.4 },
  'metal-rig': { id: 'metal-rig', background: '#11050d', primary: '#ff293e', secondary: '#d6d6e6', particles: 0.75, cameraShake: 0.2 },
  'punk-green': { id: 'punk-green', background: '#08170c', primary: '#5df77c', secondary: '#f0e05b', particles: 0.7, cameraShake: 0.24 },
  'pop-flash': { id: 'pop-flash', background: '#101018', primary: '#f4f1e8', secondary: '#7dffb3', particles: 0.55, cameraShake: 0.16 },
  'iron-march': { id: 'iron-march', background: '#14080c', primary: '#ff2a2a', secondary: '#f2c14e', particles: 0.8, cameraShake: 0.28 },
  'troop-gold': { id: 'troop-gold', background: '#141004', primary: '#e6b325', secondary: '#f4f1e8', particles: 0.5, cameraShake: 0.12 },
  'phil-ember': { id: 'phil-ember', background: '#1c0c08', primary: '#ff7a32', secondary: '#ffd0a8', particles: 0.85, cameraShake: 0.3 },
  'sambora-amber': { id: 'sambora-amber', background: '#1a1008', primary: '#ffb020', secondary: '#ffe7b0', particles: 0.6, cameraShake: 0.18 },
  'funky-magenta': { id: 'funky-magenta', background: '#160816', primary: '#ff2bd6', secondary: '#7af0ff', particles: 0.72, cameraShake: 0.22 },
  'soaring-ice': { id: 'soaring-ice', background: '#071018', primary: '#d7f7ff', secondary: '#6ecbff', particles: 0.4, cameraShake: 0.08 },
  'eddie-rose': { id: 'eddie-rose', background: '#160810', primary: '#ff4d8d', secondary: '#ffd0e0', particles: 0.66, cameraShake: 0.2 },
  'chuck-cream': { id: 'chuck-cream', background: '#12100c', primary: '#f3e2c2', secondary: '#d2a15a', particles: 0.35, cameraShake: 0.08 },
  'boogie-gold': { id: 'boogie-gold', background: '#161004', primary: '#ffd15c', secondary: '#ff7a45', particles: 0.62, cameraShake: 0.2 },
  'tophat-crimson': { id: 'tophat-crimson', background: '#14060a', primary: '#e10600', secondary: '#f4f1e8', particles: 0.78, cameraShake: 0.26 },
}

export function themeForPreset(name: string): string {
  return PRESET_THEMES[name.trim().toLowerCase()] ?? FALLBACK_THEME
}

export function lookFor(id: string | undefined): ThemeLook {
  return themes[id ?? ''] ?? themes[FALLBACK_THEME]!
}
