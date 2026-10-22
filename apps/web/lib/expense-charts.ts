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

/** One thing to pay or to receive on someone's settle card. */
export interface SettleLine {
  /** Another member, or the shared pool. */
  kind: 'person' | 'pool'
  /** The other member's id, or the pool id. */
  id: string
  name: string
  amountMinor: string
  /** Person lines: the expenses behind it; negative ones were paid the other way and are taken off. */
  items: { title: string; amountMinor: string }[]
  /** Pool lines: what this person put in and used. */
  contributedMinor: string
  usedMinor: string
}

/** Everything one person has to pay and receive to settle up. */
export interface SettleCard {
  id: string
  name: string
  /** Received − paid. */
  netMinor: string
  pay: SettleLine[]
  get: SettleLine[]
}

type SettleInput = Pick<ExpenseSummaryDto, 'parties' | 'transfers' | 'pool'>

/**
 * One card per person: whom to pay and whom to receive from, with the reason.
 * The pool is settled on its own: whoever used more than they put in pays into
 * it, whoever put in more gets the rest back. The viewer comes first, then the
 * people who pay most, then those who receive.
 */
export function settleCards(summary: SettleInput, meId: string | null): SettleCard[] {
  const cards = new Map<string, SettleCard>()
  const card = (id: string, name: string) => {
    let c = cards.get(id)
    if (!c) {
      c = { id, name, netMinor: '0', pay: [], get: [] }
      cards.set(id, c)
    }
    return c
  }
  const blank = { contributedMinor: '0', usedMinor: '0' }
  for (const tr of summary.transfers) {
    const items = tr.items.map((i) => ({ title: i.title, amountMinor: i.amountMinor }))
    card(tr.from, tr.fromName).pay.push({
      kind: 'person',
      id: tr.to,
      name: tr.toName,
      amountMinor: tr.amountMinor,
      items,
      ...blank,
    })
    card(tr.to, tr.toName).get.push({
      kind: 'person',
      id: tr.from,
      name: tr.fromName,
      amountMinor: tr.amountMinor,
      items,
      ...blank,
    })
  }
  for (const m of summary.pool) {
    const net = BigInt(m.netMinor)
    if (net === 0n) continue
    const line: SettleLine = {
      kind: 'pool',
      id: POOL_ID,
      name: '',
      amountMinor: (net < 0n ? -net : net).toString(),
      items: [],
      contributedMinor: m.contributedMinor,
      usedMinor: m.usedMinor,
    }
    const c = card(m.userId, m.name)
    if (net < 0n) c.pay.unshift(line)
    else c.get.unshift(line)
  }
  if (meId && !cards.has(meId)) {
    const me = summary.parties.find((p) => p.id === meId)
    if (me) card(me.id, me.name)
  }
  const total = (lines: SettleLine[]) => lines.reduce((sum, l) => sum + BigInt(l.amountMinor), 0n)
  const out = [...cards.values()].map((c) => ({
    ...c,
    netMinor: (total(c.get) - total(c.pay)).toString(),
  }))
  return out.sort((a, b) => {
    if (a.id === meId) return -1
    if (b.id === meId) return 1
    const diff = BigInt(a.netMinor) - BigInt(b.netMinor)
    return diff === 0n ? a.name.localeCompare(b.name) : diff < 0n ? -1 : 1
  })
}

/** How many payments are left before everyone is even (0 = settled). */
export function settleCount(summary: Pick<ExpenseSummaryDto, 'transfers' | 'pool'>): number {
  return summary.transfers.length + summary.pool.filter((m) => BigInt(m.netMinor) !== 0n).length
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
