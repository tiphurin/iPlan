import { LedgerCategory, type LedgerEntryDto } from '@iplan/contracts'
import type { EntryWithShares } from './ledgers.repository'

export type NameOf = (userId: string) => string

export function toLedgerEntryDto(row: EntryWithShares, nameOf: NameOf): LedgerEntryDto {
  return {
    id: row.id,
    ledgerId: row.ledgerId,
    kind: row.kind,
    title: row.title,
    category: LedgerCategory.catch('other').parse(row.category),
    amountMinor: row.amountMinor.toString(),
    date: row.date,
    paidBy: row.paidBy,
    paidByName: nameOf(row.paidBy),
    splitMode: row.splitMode,
    shares: row.shares.map((s) => ({
      userId: s.userId,
      name: nameOf(s.userId),
      amountMinor: s.amountMinor.toString(),
      percentBp: s.percentBp,
    })),
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  }
}
