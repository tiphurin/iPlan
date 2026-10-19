/** Stable cover colour per trip, picked from the subway line palette. */
const PALETTE = ['#00a84d', '#0090d2', '#996cac', '#ef7c1c', '#0052a4', '#1f2a37'] as const

export function tripColor(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0]
}

/** Whole days from `today` to `date` (both "YYYY-MM-DD"). */
export function daysBetween(today: string, date: string): number {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  )
}
