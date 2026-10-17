/**
 * Monthly personal finance: recurring lines (salary, tax, social security,
 * provident fund, rent...) with per-month overrides, plus one-off transactions.
 * Amounts are positive minor units of the user's base currency.
 */
export class BudgetError extends Error {
  override readonly name = 'BudgetError'
}

/** Calendar month as "YYYY-MM". */
export type Month = `${number}-${number}`

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/

export function parseMonth(value: string): Month {
  if (!MONTH.test(value)) throw new BudgetError(`Invalid month: ${value}`)
  return value as Month
}

export function addMonths(month: Month, delta: number): Month {
  const [, y, m] = MONTH.exec(month) ?? []
  const index = Number(y) * 12 + (Number(m) - 1) + delta
  const year = Math.floor(index / 12)
  const mon = (index % 12) + 1
  return `${String(year).padStart(4, '0')}-${String(mon).padStart(2, '0')}` as Month
}

/** Inclusive list of months from `start` to `end`. */
export function monthRange(start: Month, end: Month): Month[] {
  if (start > end) return []
  const months: Month[] = []
  for (let m = start; m <= end; m = addMonths(m, 1)) months.push(m)
  return months
}

export type RecurringKind = 'income' | 'deduction' | 'fixed'

export interface RecurringRule {
  readonly id: string
  readonly kind: RecurringKind
  readonly name: string
  readonly amount: bigint
  readonly startMonth: Month
  /** Last month the rule applies (inclusive); open-ended when omitted. */
  readonly endMonth?: Month
  readonly categoryId?: string
}

/** Fix or adjust one rule for one month. `amount: null` skips the rule that month. */
export interface RecurringOverride {
  readonly ruleId: string
  readonly month: Month
  readonly amount: bigint | null
  readonly note?: string
}

export interface MonthlyLine {
  readonly ruleId: string
  readonly kind: RecurringKind
  readonly name: string
  readonly amount: bigint
  readonly planned: bigint
  readonly overridden: boolean
  readonly categoryId?: string
}

export function linesForMonth(
  rules: readonly RecurringRule[],
  overrides: readonly RecurringOverride[],
  month: Month,
): MonthlyLine[] {
  const overrideByRule = new Map(
    overrides.filter((o) => o.month === month).map((o) => [o.ruleId, o] as const),
  )
  const lines: MonthlyLine[] = []
  for (const rule of rules) {
    if (rule.amount < 0n) throw new BudgetError(`Rule ${rule.id} has a negative amount`)
    if (month < rule.startMonth || (rule.endMonth !== undefined && month > rule.endMonth)) continue
    const override = overrideByRule.get(rule.id)
    if (override && override.amount === null) continue
    lines.push({
      ruleId: rule.id,
      kind: rule.kind,
      name: rule.name,
      amount: override ? (override.amount as bigint) : rule.amount,
      planned: rule.amount,
      overridden: override !== undefined,
      ...(rule.categoryId !== undefined && { categoryId: rule.categoryId }),
    })
  }
  return lines
}

export interface Transaction {
  readonly id: string
  /** Positive minor units; `kind` says which way the money moved. */
  readonly amount: bigint
  readonly kind: 'income' | 'expense'
  readonly month: Month
  readonly categoryId?: string
}

export interface MonthlySummary {
  readonly month: Month
  readonly grossIncome: bigint
  readonly deductions: bigint
  readonly netIncome: bigint
  readonly fixedCosts: bigint
  readonly oneOffIncome: bigint
  readonly oneOffExpenses: bigint
  readonly totalIncome: bigint
  readonly totalExpenses: bigint
  /** Money left at the end of the month (can be negative). */
  readonly balance: bigint
}

export function summarizeMonth(
  lines: readonly MonthlyLine[],
  transactions: readonly Transaction[],
  month: Month,
): MonthlySummary {
  const total = (kind: RecurringKind) =>
    lines.filter((l) => l.kind === kind).reduce((sum, l) => sum + l.amount, 0n)
  const inMonth = transactions.filter((t) => t.month === month)
  const oneOff = (kind: Transaction['kind']) =>
    inMonth.filter((t) => t.kind === kind).reduce((sum, t) => sum + t.amount, 0n)

  const grossIncome = total('income')
  const deductions = total('deduction')
  const fixedCosts = total('fixed')
  const oneOffIncome = oneOff('income')
  const oneOffExpenses = oneOff('expense')
  const netIncome = grossIncome - deductions
  const totalIncome = netIncome + oneOffIncome
  const totalExpenses = fixedCosts + oneOffExpenses
  return {
    month,
    grossIncome,
    deductions,
    netIncome,
    fixedCosts,
    oneOffIncome,
    oneOffExpenses,
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
  }
}

export interface CategoryBudget {
  readonly categoryId: string
  readonly limit: bigint
}

export interface CategoryUsage {
  readonly categoryId: string
  readonly limit: bigint
  readonly spent: bigint
  readonly remaining: bigint
  /** spent / limit; 1 means exactly on budget. */
  readonly ratio: number
  readonly status: 'ok' | 'warning' | 'over'
}

/** Spending per category against its monthly limit; warning from 80%. */
export function budgetUsage(
  budgets: readonly CategoryBudget[],
  lines: readonly MonthlyLine[],
  transactions: readonly Transaction[],
  month: Month,
): CategoryUsage[] {
  const spent = new Map<string, bigint>()
  const add = (categoryId: string | undefined, amount: bigint) => {
    if (categoryId === undefined) return
    spent.set(categoryId, (spent.get(categoryId) ?? 0n) + amount)
  }
  for (const line of lines) if (line.kind === 'fixed') add(line.categoryId, line.amount)
  for (const t of transactions)
    if (t.month === month && t.kind === 'expense') add(t.categoryId, t.amount)

  return budgets.map(({ categoryId, limit }) => {
    const used = spent.get(categoryId) ?? 0n
    const ratio =
      limit === 0n ? (used > 0n ? Infinity : 0) : Number((used * 10_000n) / limit) / 10_000
    return {
      categoryId,
      limit,
      spent: used,
      remaining: limit - used,
      ratio,
      status: ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok',
    }
  })
}
