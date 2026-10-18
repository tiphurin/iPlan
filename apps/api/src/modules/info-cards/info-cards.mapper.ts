import type { InfoCardDto } from '@iplan/contracts'
import type { InfoCardRow } from './info-cards.repository'

export function toInfoCardDto(row: InfoCardRow): InfoCardDto {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  }
}
