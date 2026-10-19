import { type ExpenseSummaryDto, POOL_ID } from '@iplan/contracts'

/** One bar of the daily spending chart; amounts in base minor units. */
export interface DayBar {
  key: string
  /** Short axis label: day of month, plus the month on the first day and on the 1st. */
  label: string
  spent: number
  budget: number | null
  over: boolean
}

/** Daily spending vs the daily budget, for every day of the trip. */
export function dayBars(byDay: ExpenseSummaryDto['byDay']): DayBar[] {
  return byDay.map((d, i) => {
    const [, month, day] = d.dayDate.split('-').map(Number)
    const spent = BigInt(d.spentMinor)
    const budget = d.budgetMinor === null ? null : BigInt(d.budgetMinor)
    return {
      key: d.dayDate,
      label: i === 0 || day === 1 ? `${day}/${month}` : String(day),
      spent: Number(spent),
      budget: budget === null ? null : Number(budget),
      over: budget !== null && spent > budget,
    }
  })
}

/** Paid out of pocket vs fair share for one member (or the pool). */
export interface PersonBar {
  id: string
  name: string
  isPool: boolean
  paid: number
  share: number
  /** Positive: gets money back. Negative: still owes. */
  net: number
}

/**
 * Members who paid or owe something, biggest share first. The pool only
 * appears when it paid for something (it never has a share of its own).
 */
export function personBars(parties: ExpenseSummaryDto['parties']): PersonBar[] {
  return parties
    .map((p) => ({
      id: p.id,
      name: p.name,
      isPool: p.id === POOL_ID,
      paid: Number(p.paidMinor),
      share: Number(p.shareMinor),
      net: Number(p.netMinor),
    }))
    .filter((p) => p.paid !== 0 || p.share !== 0)
    .sort((a, b) => b.share - a.share || b.paid - a.paid || a.name.localeCompare(b.name))
}

/** The viewer's share of the spending in base minor units, or null if they are not a party. */
export function viewerShare(
  parties: ExpenseSummaryDto['parties'],
  userId: string | null,
): string | null {
  if (!userId) return null
  return parties.find((p) => p.id === userId)?.shareMinor ?? null
}

/** Largest value a chart has to fit, never below 1 so scales never divide by zero. */
export function chartMax(values: (number | null)[]): number {
  return values.reduce<number>((max, v) => Math.max(max, v ?? 0), 1)
}

/** One row of the balance chart: what someone gets back (+) or still owes (−). */
export interface BalanceRow {
  id: string
  name: string
  isPool: boolean
  paid: number
  share: number
  net: number
}

/**
 * Everyone involved in the spending, those owed money first and those who owe
 * most last, so the chart reads top (gets back) to bottom (owes).
 */
export function balanceRows(parties: ExpenseSummaryDto['parties']): BalanceRow[] {
  return personBars(parties)
    .map(({ id, name, isPool, paid, share, net }) => ({ id, name, isPool, paid, share, net }))
    .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name))
}

/** What the settle tab says first, in plain words. */
export type SettleHeadline =
  | { kind: 'settled' }
  | { kind: 'single'; transfer: ExpenseSummaryDto['transfers'][number] }
  | { kind: 'many'; count: number; totalMinor: string }

export function settleHeadline(transfers: ExpenseSummaryDto['transfers']): SettleHeadline {
  const [first] = transfers
  if (!first) return { kind: 'settled' }
  if (transfers.length === 1) return { kind: 'single', transfer: first }
  const total = transfers.reduce((sum, tr) => sum + BigInt(tr.amountMinor), 0n)
  return { kind: 'many', count: transfers.length, totalMinor: total.toString() }
}
