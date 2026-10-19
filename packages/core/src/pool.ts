/**
 * The shared pool (kitty): money members put in, spending the pool paid for,
 * and how that spending is shared. All amounts are base-currency minor units.
 */
import { type Shares, type SplitExpense, computeBalances, splitByWeights } from './split'

/**
 * - `actual`: pool-paid expenses keep their own split; whoever put in more than
 *   they used gets the difference back.
 * - `proportional`: pool-paid expenses are shared by how much each member put in,
 *   so leftovers come back (and shortfalls are owed) in that same proportion.
 */
export type PoolMode = 'actual' | 'proportional'

export interface PoolContribution {
  readonly userId: string
  /** Base-currency minor units, above zero. */
  readonly amount: bigint
}

export interface PoolOptions {
  /** Party id the pool uses in expenses' `paidBy`. */
  readonly poolId: string
  readonly mode: PoolMode
  readonly contributions: readonly PoolContribution[]
}

/** Total put in per member, in the order members first contributed. */
export function contributedBy(contributions: readonly PoolContribution[]): Shares {
  const totals: Record<string, bigint> = {}
  for (const c of contributions) totals[c.userId] = (totals[c.userId] ?? 0n) + c.amount
  return totals
}

/**
 * Pool-paid expenses with their shares as the mode says. In `proportional` mode
 * each pool-paid expense is split by contribution weight (largest remainder, so
 * the shares still add up); with no contributions yet the expense's own split stays.
 */
export function applyPoolMode(
  expenses: readonly SplitExpense[],
  options: PoolOptions,
): SplitExpense[] {
  const weights = Object.fromEntries(
    Object.entries(contributedBy(options.contributions)).filter(([, amount]) => amount > 0n),
  )
  if (options.mode !== 'proportional' || Object.keys(weights).length === 0) return [...expenses]
  return expenses.map((expense) =>
    expense.paidBy === options.poolId
      ? { ...expense, shares: splitByWeights(expense.amount, weights) }
      : expense,
  )
}

/**
 * Net balance per party with the pool rules applied: each contribution counts
 * as money a member handed to the pool (member +amount, pool −amount). The pool
 * then ends up negative when it has money left to hand back, positive when it
 * spent more than it was given, and `settle` turns that into transfers.
 */
export function poolBalances(expenses: readonly SplitExpense[], options: PoolOptions): Shares {
  const balances: Record<string, bigint> = { ...computeBalances(applyPoolMode(expenses, options)) }
  for (const c of options.contributions) {
    balances[c.userId] = (balances[c.userId] ?? 0n) + c.amount
    balances[options.poolId] = (balances[options.poolId] ?? 0n) - c.amount
  }
  return balances
}

export interface PoolSummary {
  readonly totalIn: bigint
  readonly spent: bigint
  /** Positive: left over in the pool. Negative: the pool is short. */
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
