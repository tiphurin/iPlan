import { TripItemDetails, type TripItemDto } from '@iplan/contracts'
import type { CheckInRow, ItemRow } from './items.repository'

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
    // Stored JSON may predate today's schema; keep what still parses.
    details: TripItemDetails.catch({}).parse(row.details),
    sortOrder: row.sortOrder,
    checkIns: checkIns
      .filter((c) => c.itemId === row.id)
      .map((c) => ({ userId: c.userId, name: c.name, checkedInAt: c.checkedInAt.toISOString() })),
  }
}
