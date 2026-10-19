import { TRIP_COLORS, type TripColor } from '@iplan/contracts'

/** Fallback cover colour for a trip without a chosen one: stable per id, from the shared palette. */
export function tripColor(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return TRIP_COLORS[hash % TRIP_COLORS.length] ?? TRIP_COLORS[0]
}

/** The colour a trip's cover shows: the chosen one, else the id-based fallback. */
export function coverColor(trip: { id: string; color?: string | null }): string {
  return trip.color ?? tripColor(trip.id)
}

/** Colour to preselect for a new trip: the one the user's trips use least (palette order breaks ties). */
export function suggestTripColor(trips: { id: string; color?: string | null }[]): TripColor {
  const used = new Map<string, number>()
  for (const trip of trips) used.set(coverColor(trip), (used.get(coverColor(trip)) ?? 0) + 1)
  let best: TripColor = TRIP_COLORS[0]
  for (const color of TRIP_COLORS) {
    if ((used.get(color) ?? 0) < (used.get(best) ?? 0)) best = color
  }
  return best
}

/** Whole days from `today` to `date` (both "YYYY-MM-DD"). */
export function daysBetween(today: string, date: string): number {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  )
}
