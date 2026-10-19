import { TripItemDetails, type TripItemDto } from '@iplan/contracts'
import type { z } from 'zod'
import type { CheckInRow, ItemRow } from './items.repository'

/**
 * Stored JSON may predate today's schema. Keep every key that still parses
 * (unknown keys included) and drop only the ones that don't, such as a link
 * that is not http(s).
 */
export function parseDetails(raw: unknown): TripItemDetails {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const whole = TripItemDetails.safeParse(raw)
  if (whole.success) return whole.data
  const shape: Record<string, z.ZodType | undefined> = TripItemDetails.shape
  const kept: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    const field = shape[key]
    if (!field) kept[key] = value
    else {
      const parsed = field.safeParse(value)
      if (parsed.success) kept[key] = parsed.data
    }
  }
  return TripItemDetails.catch({}).parse(kept)
}

export function toItemDto(row: ItemRow, checkIns: CheckInRow[]): TripItemDto {
  return {
    id: row.id,
    tripId: row.tripId,
    dayDate: row.dayDate,
    kind: row.kind,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    timeZone: row.timeZone,
    notes: row.notes,
    details: parseDetails(row.details),
    sortOrder: row.sortOrder,
    checkIns: checkIns
      .filter((c) => c.itemId === row.id)
      .map((c) => ({
        userId: c.userId,
        name: c.name,
        checkedInAt: c.checkedInAt.toISOString(),
        skipped: c.skipped,
      })),
  }
}
