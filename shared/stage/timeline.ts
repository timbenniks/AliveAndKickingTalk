import type { StageCue, StageSection, StageSong } from './types.ts'
import { styleForCue } from './styles.ts'
import { themeForPreset } from './themes.ts'

export interface ChapterMark {
  id: string
  at: number
  label: string
  detail: string
  theme: string
  style: string
  kind: 'section' | 'amp'
}

export function noteDistance(at: number, playbackTime: number, speed: number): number {
  return (at - playbackTime) * speed
}

export function activeCue(cues: StageCue[], timeSeconds: number): StageCue | undefined {
  let best: StageCue | undefined
  for (const cue of cues) {
    if (cue.at <= timeSeconds && (!best || cue.at >= best.at)) best = cue
  }
  return best
}

export function activeSection(sections: StageSection[], timeSeconds: number): StageSection | undefined {
  const sorted = [...sections].sort((a, b) => a.start - b.start)
  const last = sorted.at(-1)
  if (last && timeSeconds >= last.start && timeSeconds === last.end) return last
  return [...sorted].reverse().find(section => timeSeconds >= section.start && timeSeconds < section.end)
}

export function chapterMarks(chart: { cues: StageCue[], sections: StageSection[] }): ChapterMark[] {
  if (chart.sections.length > 0) {
    return [...chart.sections]
      .sort((a, b) => a.start - b.start)
      .map(section => ({
        id: section.id,
        at: section.start,
        label: section.title,
        detail: 'Section',
        theme: section.theme ?? 'neon-stadium',
        style: section.style ?? 'stadium-smoke',
        kind: 'section' as const,
      }))
  }
  return [...chart.cues]
    .sort((a, b) => a.at - b.at)
    .map(cue => ({
      id: cue.id,
      at: cue.at,
      label: cue.presetName ?? 'Amp cue',
      detail: cue.programChange == null ? 'Amp cue' : `Program ${cue.programChange}`,
      theme: cue.theme ?? 'neon-stadium',
      style: cue.style ?? 'stadium-smoke',
      kind: 'amp' as const,
    }))
}

export function presetCues(song: StageSong): StageCue[] {
  return [...song.presets]
    .sort((a, b) => a.at - b.at)
    .map((preset, index) => {
      const style = styleForCue(song.songId, preset.at, preset.name)
      return {
        id: `preset-${index}`,
        at: preset.at,
        type: 'preset' as const,
        presetName: preset.name,
        programChange: preset.pc,
        theme: style.fromChapter ? style.theme : themeForPreset(preset.name),
        style: style.id,
      }
    })
}

export function lengthToSeconds(length: string): number | null {
  const match = /^(\d+):(\d{2})$/.exec(length.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const remain = whole % 60
  return `${minutes}:${remain.toString().padStart(2, '0')}`
}
