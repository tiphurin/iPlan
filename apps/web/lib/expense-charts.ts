import { type ExpenseSummaryDto, POOL_ID, type PoolDto } from '@iplan/contracts'

/** A summary party; `contributedMinor` is optional so older summaries still read. */
type Party = Omit<ExpenseSummaryDto['parties'][number], 'contributedMinor'> & {
  contributedMinor?: string
}

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
  /** Put into the shared pool (0 for the pool itself). */
  contributed: number
  /** Positive: gets money back. Negative: still owes. */
  net: number
}

/**
 * Members who paid, put money in or owe something, biggest share first. The pool
 * only appears when money went through it (it never has a share of its own).
 */
export function personBars(parties: readonly Party[]): PersonBar[] {
  return parties
    .map((p) => ({
      id: p.id,
      name: p.name,
      isPool: p.id === POOL_ID,
      paid: Number(p.paidMinor),
      share: Number(p.shareMinor),
      contributed: Number(p.contributedMinor ?? 0),
      net: Number(p.netMinor),
    }))
    .filter((p) => p.paid !== 0 || p.share !== 0 || p.contributed !== 0 || p.net !== 0)
    .sort((a, b) => b.share - a.share || b.paid - a.paid || a.name.localeCompare(b.name))
}

/** The viewer's share of the spending in base minor units, or null if they are not a party. */
export function viewerShare(parties: readonly Party[], userId: string | null): string | null {
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
  contributed: number
  net: number
}

/**
 * Everyone involved in the spending, those owed money first and those who owe
 * most last, so the chart reads top (gets back) to bottom (owes).
 */
export function balanceRows(parties: readonly Party[]): BalanceRow[] {
  return personBars(parties)
    .map(({ id, name, isPool, paid, share, contributed, net }) => ({
      id,
      name,
      isPool,
      paid,
      share,
      contributed,
      net,
    }))
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

/** What the pool card says first about who put in how much. */
export type PoolHeadline =
  | { kind: 'empty' }
  | { kind: 'only'; userId: string; name: string }
  | { kind: 'equal' }
  /** `top` put in `diffMinor` more than `other` (the next biggest). */
  | {
      kind: 'more'
      top: { userId: string; name: string }
      other: { userId: string; name: string }
      diffMinor: string
      /** More than two people: `top` put in the most. */
      most: boolean
    }

export function poolHeadline(byMember: PoolDto['byMember']): PoolHeadline {
  const people = [...byMember]
    .filter((m) => BigInt(m.contributedBaseMinor) > 0n)
    .sort((a, b) => {
      const diff = BigInt(b.contributedBaseMinor) - BigInt(a.contributedBaseMinor)
      return diff === 0n ? a.name.localeCompare(b.name) : diff > 0n ? 1 : -1
    })
  const [top, next] = people
  if (!top) return { kind: 'empty' }
  if (!next) return { kind: 'only', userId: top.userId, name: top.name }
  const diff = BigInt(top.contributedBaseMinor) - BigInt(next.contributedBaseMinor)
  if (diff === 0n && people.every((p) => p.contributedBaseMinor === top.contributedBaseMinor)) {
    return { kind: 'equal' }
  }
  if (diff === 0n) {
    // Two or more tied at the top: compare the top with the smallest instead.
    const last = people.at(-1) ?? next
    return {
      kind: 'more',
      top: { userId: top.userId, name: top.name },
      other: { userId: last.userId, name: last.name },
      diffMinor: (BigInt(top.contributedBaseMinor) - BigInt(last.contributedBaseMinor)).toString(),
      most: false,
    }
  }
  return {
    kind: 'more',
    top: { userId: top.userId, name: top.name },
    other: { userId: next.userId, name: next.name },
    diffMinor: diff.toString(),
    most: people.length > 2,
  }
}
