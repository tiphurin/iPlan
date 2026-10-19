import type { TransportMode } from '@iplan/contracts'

/** Ready-made route styles for "move" items: tap one instead of picking a colour. */
export interface LinePreset {
  /** Stored as details.line; "W" draws a dotted walking line. */
  line: string
  color: string
  /** Message key under "lines" (modes) or a literal label (subway lines). */
  label: string
  emoji?: string
  /** The matching transport expense kind, for "add expense here". */
  mode?: TransportMode
}

export const MODE_PRESETS: LinePreset[] = [
  { line: 'W', color: '#9aa3ae', label: 'walk', emoji: '🚶', mode: 'walk' },
  { line: 'TAXI', color: '#e0a100', label: 'taxi', emoji: '🚕', mode: 'taxi' },
  { line: 'GRAB', color: '#00b14f', label: 'grab', emoji: '🟢', mode: 'grab' },
  { line: 'BOLT', color: '#2a9d5c', label: 'bolt', emoji: '⚡', mode: 'bolt' },
  { line: 'LINEMAN', color: '#06c755', label: 'lineman', emoji: '🛵', mode: 'lineman' },
  { line: 'car', color: '#4a5563', label: 'drive', emoji: '🚗', mode: 'drive' },
  { line: 'TRAIN', color: '#1f2a37', label: 'train', emoji: '🚆', mode: 'train' },
  { line: 'BUS', color: '#0068b7', label: 'bus', emoji: '🚌', mode: 'bus' },
  { line: 'BOAT', color: '#0e7490', label: 'boat', emoji: '⛴️', mode: 'boat' },
  { line: 'FLY', color: '#6366f1', label: 'plane', emoji: '✈️', mode: 'plane' },
]

/** Seoul Metro and airport lines in their official colours. */
export const SEOUL_LINES: LinePreset[] = [
  { line: '1', color: '#0052a4', label: '1', mode: 'train' },
  { line: '2', color: '#00a84d', label: '2', mode: 'train' },
  { line: '3', color: '#ef7c1c', label: '3', mode: 'train' },
  { line: '4', color: '#00a5de', label: '4', mode: 'train' },
  { line: '5', color: '#996cac', label: '5', mode: 'train' },
  { line: '6', color: '#cd7c2f', label: '6', mode: 'train' },
  { line: '7', color: '#747f00', label: '7', mode: 'train' },
  { line: '8', color: '#e6186c', label: '8', mode: 'train' },
  { line: '9', color: '#bdb092', label: '9', mode: 'train' },
  { line: 'AREX', color: '#0090d2', label: 'AREX', mode: 'train' },
  { line: 'S', color: '#d4003b', label: 'Shinbundang', mode: 'train' },
  { line: 'K', color: '#77c4a3', label: 'Gyeongui', mode: 'train' },
]

export function findPreset(line: string | undefined, color: string | undefined) {
  return [...MODE_PRESETS, ...SEOUL_LINES].find(
    (p) => p.line === line && p.color.toLowerCase() === (color ?? '').toLowerCase(),
  )
}

/** The emoji for a travel mode line ("GRAB" → 🟢), if it is one. */
export function modeEmoji(line: string | undefined): string | undefined {
  return MODE_PRESETS.find((p) => p.line === line)?.emoji
}

/** Transport kind for an item's line, e.g. to prefill a transport expense. */
export function modeOfLine(line: string | undefined): TransportMode | undefined {
  return [...MODE_PRESETS, ...SEOUL_LINES].find((p) => p.line === line)?.mode
}
