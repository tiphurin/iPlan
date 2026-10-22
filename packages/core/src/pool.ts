/**
 * The shared pool (kitty): a common wallet members put money into and spend
 * from. Everyone pays only what they used: whoever put in more than they used
 * gets the rest back, whoever used pool money without putting enough in pays
 * the difference into the pool. The pool can never go below zero.
 * All amounts are base-currency minor units.
 */
import { type Shares, type SplitExpense, computeBalances, splitByWeights } from './split'

export interface PoolContribution {
  readonly userId: string
  /** Base-currency minor units, above zero. */
  readonly amount: bigint
}

export interface PoolOptions {
  /** Party id the pool uses in expenses' `paidBy`. */
  readonly poolId: string
  readonly contributions: readonly PoolContribution[]
}

/** Total put in per member, in the order members first contributed. */
export function contributedBy(contributions: readonly PoolContribution[]): Shares {
  const totals: Record<string, bigint> = {}
  for (const c of contributions) totals[c.userId] = (totals[c.userId] ?? 0n) + c.amount
  return totals
}

/**
 * Overall net per member (pool and person-to-person together): positive = gets
 * money back, negative = pays. The pool's own entry is what it hands back.
 */
export function poolBalances(expenses: readonly SplitExpense[], options: PoolOptions): Shares {
  const balances: Record<string, bigint> = { ...computeBalances(expenses) }
  for (const c of options.contributions) {
    balances[c.userId] = (balances[c.userId] ?? 0n) + c.amount
    balances[options.poolId] = (balances[options.poolId] ?? 0n) - c.amount
  }
  return balances
}

export interface PoolMemberSettlement {
  readonly userId: string
  /** Put into the pool. */
  readonly contributed: bigint
  /** Their shares of what the pool paid for. */
  readonly used: bigint
  /** contributed − used: positive = gets back from the pool, negative = pays into it. */
  readonly net: bigint
}

/**
 * Each member against the pool: put in minus used. Members who never touched
 * the pool are left out. The nets add up to what is left in the pool.
 */
export function poolSettlement(
  expenses: readonly SplitExpense[],
  options: PoolOptions,
): PoolMemberSettlement[] {
  const contributed = contributedBy(options.contributions)
  const used: Record<string, bigint> = {}
  for (const e of expenses) {
    if (e.paidBy !== options.poolId) continue
    for (const [id, share] of Object.entries(e.shares)) used[id] = (used[id] ?? 0n) + share
  }
  const ids = [...new Set([...Object.keys(contributed), ...Object.keys(used)])]
  return ids
    .map((userId) => {
      const c = contributed[userId] ?? 0n
      const u = used[userId] ?? 0n
      return { userId, contributed: c, used: u, net: c - u }
    })
    .filter((m) => m.contributed !== 0n || m.used !== 0n)
}

/** One expense behind a person-to-person transfer. */
export interface PairItem {
  /** Index of the expense in the input list. */
  readonly index: number
  /** Positive when it adds to what `from` owes `to`, negative when it takes away. */
  readonly amount: bigint
}

export interface PairTransfer {
  readonly from: string
  readonly to: string
  readonly amount: bigint
  readonly items: readonly PairItem[]
}

/**
 * Person-to-person debts from expenses members paid themselves (pool-paid ones
 * are settled with the pool). Each pair is netted on its own, so everyone pays
 * the people who actually paid for them, never a third person.
 */
export function pairTransfers(expenses: readonly SplitExpense[], poolId: string): PairTransfer[] {
  // key "x|y" with x < y: positive = x owes y.
  const pairs = new Map<string, { total: bigint; items: PairItem[] }>()
  expenses.forEach((e, index) => {
    if (e.paidBy === poolId) return
    for (const [id, share] of Object.entries(e.shares)) {
      if (id === e.paidBy || share === 0n) continue
      const [x, y] = id < e.paidBy ? [id, e.paidBy] : [e.paidBy, id]
      const signed = id === x ? share : -share
      const pair = pairs.get(`${x}|${y}`) ?? { total: 0n, items: [] }
      pair.total += signed
      pair.items.push({ index, amount: signed })
      pairs.set(`${x}|${y}`, pair)
    }
  })
  const out: PairTransfer[] = []
  for (const [key, { total, items }] of pairs) {
    if (total === 0n) continue
    const [x, y] = key.split('|') as [string, string]
    const flip = total < 0n
    out.push({
      from: flip ? y : x,
      to: flip ? x : y,
      amount: flip ? -total : total,
      items: flip ? items.map((i) => ({ ...i, amount: -i.amount })) : items,
    })
  }
  return out.sort((a, b) => (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1))
}

export interface PoolSummary {
  readonly totalIn: bigint
  readonly spent: bigint
  /** What is left in the pool; never below zero for new spending. */
  readonly leftover: bigint
  /** Per member: how much they put in and their share of the total in basis points. */
  readonly byMember: readonly { userId: string; contributed: bigint; percentBp: number }[]
}

export function summarizePool(
  expenses: readonly SplitExpense[],
  contributions: readonly PoolContribution[],
  poolId: string,
): PoolSummary {
  const totals = contributedBy(contributions)
  const totalIn = Object.values(totals).reduce((a, b) => a + b, 0n)
  const spent = expenses.filter((e) => e.paidBy === poolId).reduce((sum, e) => sum + e.amount, 0n)
  const positive = Object.fromEntries(Object.entries(totals).filter(([, v]) => v > 0n))
  const bp =
    totalIn > 0n && Object.keys(positive).length > 0 ? splitByWeights(10_000n, positive) : {}
  return {
    totalIn,
    spent,
    leftover: totalIn - spent,
    byMember: Object.entries(totals).map(([userId, contributed]) => ({
      userId,
      contributed,
      percentBp: Number(bp[userId] ?? 0n),
    })),
  }
}
