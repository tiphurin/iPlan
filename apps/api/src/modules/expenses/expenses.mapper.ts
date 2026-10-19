import { type ExpenseDto, POOL_ID, type PoolContributionDto } from '@iplan/contracts'
import { splitByWeights } from '@iplan/core'
import type { ContributionRow, ExpenseWithShares } from './expenses.repository'

export type NameOf = (id: string) => string

/** Each share converted to the base currency, adding up exactly to the base total. */
export function baseShares({ expense, shares }: ExpenseWithShares): Record<string, bigint> {
  const weights = Object.fromEntries(shares.map((s) => [s.userId, s.amountMinor]))
  if (shares.length === 0 || shares.every((s) => s.amountMinor === 0n)) return {}
  return splitByWeights(expense.baseAmountMinor, weights)
}

export function toExpenseDto(found: ExpenseWithShares, nameOf: NameOf): ExpenseDto {
  const { expense, shares } = found
  const base = baseShares(found)
  return {
    id: expense.id,
    dayDate: expense.dayDate,
    itemId: expense.itemId,
    title: expense.title,
    category: expense.category,
    subcategory: expense.subcategory,
    amountMinor: expense.amountMinor.toString(),
    currency: expense.currency,
    fxRate: expense.fxRate,
    baseAmountMinor: expense.baseAmountMinor.toString(),
    paidBy: expense.paidBy,
    paidByName: nameOf(expense.paidBy),
    splitMode: expense.splitMode,
    note: expense.note,
    shares: shares.map((s) => ({
      userId: s.userId,
      name: nameOf(s.userId),
      amountMinor: s.amountMinor.toString(),
      baseAmountMinor: (base[s.userId] ?? 0n).toString(),
      percentBp: s.percentBp,
    })),
    createdAt: expense.createdAt.toISOString(),
  }
}

export function toContributionDto(row: ContributionRow, nameOf: NameOf): PoolContributionDto {
  return {
    id: row.id,
    userId: row.userId,
    name: nameOf(row.userId),
    amountMinor: row.amountMinor.toString(),
    currency: row.currency,
    fxRate: row.fxRate,
    baseAmountMinor: row.baseAmountMinor.toString(),
    date: row.date,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  }
}

export const isPool = (id: string) => id === POOL_ID
