import chapterStyles from './data/chapter-styles.json' with { type: 'json' }
import { LANE_COLORS } from './clock.ts'

export type StageEffect = 'flames' | 'smoke' | 'disco' | 'embers' | 'mist'

export interface ChapterStyle {
  id: string
  effect: StageEffect
  theme: string
  gems: string[]
  fromChapter: boolean
}

interface StyleRecord {
  effect: StageEffect
  theme: string
  gems: string[]
}

const styles = chapterStyles.styles as Record<string, StyleRecord>
const presetStyles = chapterStyles.presetStyles as Record<string, string>
const chapters = chapterStyles.chapters as Record<string, Array<{ at: number, style: string }>>

const FALLBACK = 'stadium-smoke'

export function styleById(id: string | undefined): ChapterStyle {
  const record = styles[id ?? ''] ?? styles[FALLBACK]!
  return {
    id: styles[id ?? ''] ? id! : FALLBACK,
    effect: record.effect,
    theme: record.theme,
    gems: record.gems.length === LANE_COLORS.length ? record.gems : [...LANE_COLORS],
    fromChapter: false,
  }
}

export function styleForCue(songId: string, at: number, presetName?: string): ChapterStyle {
  const listed = chapters[songId]?.find(item => Math.abs(item.at - at) < 0.05)
  const presetId = presetName ? presetStyles[presetName] : undefined
  const id = listed?.style ?? presetId ?? FALLBACK
  return { ...styleById(id), fromChapter: Boolean(listed) }
}
