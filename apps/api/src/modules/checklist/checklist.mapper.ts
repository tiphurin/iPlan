import type { ChecklistItemDto } from '@iplan/contracts'
import type { ChecklistRow, TickRow } from './checklist.repository'

export function toChecklistItemDto(row: ChecklistRow, ticks: TickRow[]): ChecklistItemDto {
  return {
    id: row.id,
    groupKey: row.groupKey,
    title: row.title,
    sortOrder: row.sortOrder,
    ticks: ticks
      .filter((t) => t.itemId === row.id)
      .map((t) => ({ userId: t.userId, name: t.name, tickedAt: t.tickedAt.toISOString() })),
  }
}
