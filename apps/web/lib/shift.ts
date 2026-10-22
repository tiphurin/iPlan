/** Which plan items move when an earlier one now ends later (or earlier). */
export interface ShiftableItem {
  id: string
  dayDate: string
  startsAt: string
  title: string
  details: { fixed?: boolean | undefined }
}

/**
 * The items after `anchor` on the same plan day, in time order, up to (not
 * including) the first one with a fixed time: a booked flight or appointment
 * stays put, and so does everything after it.
 */
export function itemsToShift<T extends ShiftableItem>(
  items: readonly T[],
  anchor: { id: string; dayDate: string; startsAt: string },
): { move: T[]; stoppedAt: T | null } {
  const after = items
    .filter(
      (i) => i.id !== anchor.id && i.dayDate === anchor.dayDate && i.startsAt > anchor.startsAt,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const stop = after.findIndex((i) => i.details.fixed === true)
  return stop === -1
    ? { move: after, stoppedAt: null }
    : { move: after.slice(0, stop), stoppedAt: after[stop] ?? null }
}

/**
 * How far the end of an item moved, in whole minutes (the start when it has no
 * end); 0 when nothing changed or the day changed (then nothing should follow).
 */
export function minutesMoved(
  before: { dayDate: string; startsAt: string; endsAt: string | null },
  after: { dayDate: string; startsAt: string; endsAt: string | null },
): number {
  if (before.dayDate !== after.dayDate) return 0
  const from = Date.parse(before.endsAt ?? before.startsAt)
  const to = Date.parse(after.endsAt ?? after.startsAt)
  return Math.round((to - from) / 60_000)
}

/** Lateness rounded up to the next 5 minutes, for "push the rest of the day back". */
export function roundUpFive(minutes: number): number {
  return Math.max(5, Math.ceil(minutes / 5) * 5)
}
