import { type LedgerMonthDto, LedgerCategory } from '@iplan/contracts'
import { type Transfer, computeBalances, settle } from '@iplan/core'
import type { EntryWithShares } from './ledgers.repository'

const sharesOf = (e: EntryWithShares) =>
  Object.fromEntries(e.shares.map((s) => [s.userId, s.amountMinor]))

const sum = (transfers: readonly Transfer[]) => transfers.reduce((a, t) => a + t.amount, 0n)

/**
 * Which month a settlement counts for: its month tag, else the paid-back expense's
 * month, else the month it was paid in (plain "settle up" entries).
 */
export function settlementMonth(e: EntryWithShares, byId: Map<string, EntryWithShares>): string {
  if (e.settlesMonth) return e.settlesMonth
  const expense = e.settlesEntryId ? byId.get(e.settlesEntryId) : undefined
  return (expense ?? e).date.slice(0, 7)
}

/** One month's spending and the settlements counted for it. */
export function monthParts(entries: EntryWithShares[], month: string) {
  const byId = new Map(entries.map((e) => [e.id, e]))
  const spent = entries.filter((e) => e.kind === 'expense' && e.date.startsWith(month))
  const settlements = entries.filter(
    (e) => e.kind === 'settlement' && settlementMonth(e, byId) === month,
  )
  const asSplit = (e: EntryWithShares) => ({
    paidBy: e.paidBy,
    amount: e.amountMinor,
    shares: sharesOf(e),
  })
  /** Who should pay whom for that month's spending alone. */
  const owed = settle(computeBalances(spent.map(asSplit)))
  /** What is still open after that month's settlements (overpaying flips the direction). */
  const remaining = settle(computeBalances([...spent, ...settlements].map(asSplit)))
  return { spent, settlements, owed, remaining }
}

/**
 * Monthly cards: spending per month, who still owes whom for that month (after its
 * settlements), and how much has been paid back. Months with only settlements are
 * listed too, so they can be seen and undone.
 */
export function monthSummaries(entries: EntryWithShares[], meId: string): LedgerMonthDto[] {
  const byId = new Map(entries.map((e) => [e.id, e]))
  const keys = new Set(
    entries.map((e) => (e.kind === 'expense' ? e.date.slice(0, 7) : settlementMonth(e, byId))),
  )
  return [...keys]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const { spent, settlements, owed, remaining } = monthParts(entries, month)
      const total = spent.reduce((s, e) => s + e.amountMinor, 0n)
      const mine = spent.reduce(
        (s, e) => s + (e.shares.find((x) => x.userId === meId)?.amountMinor ?? 0n),
        0n,
      )
      const categories = new Map<string, bigint>()
      for (const e of spent)
        categories.set(e.category, (categories.get(e.category) ?? 0n) + e.amountMinor)
      const need = sum(owed)
      const paid = settlements.reduce((s, e) => s + e.amountMinor, 0n)
      const status: LedgerMonthDto['status'] =
        remaining.length === 0
          ? settlements.length === 0
            ? 'none'
            : 'paid'
          : settlements.length === 0
            ? 'unpaid'
            : 'partial'
      return {
        month,
        totalMinor: total.toString(),
        myShareMinor: mine.toString(),
        byCategory: [...categories.entries()]
          .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
          .map(([category, value]) => ({
            category: LedgerCategory.catch('other').parse(category),
            totalMinor: value.toString(),
          })),
        owed: owed.map((t) => ({
          from: t.from,
          to: t.to,
          amountMinor: t.amount.toString(),
        })),
        transfers: remaining.map((t) => ({
          from: t.from,
          to: t.to,
          amountMinor: t.amount.toString(),
        })),
        needMinor: need.toString(),
        paidMinor: paid.toString(),
        status,
      }
    })
}
