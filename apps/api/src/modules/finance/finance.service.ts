import type {
  FinanceCategoryDto,
  FinanceCategoryInput,
  FinanceOverviewDto,
  MonthDto,
  MonthSummaryDto,
  OverrideInput,
  RecurringRuleDto,
  RecurringRuleInput,
  TransactionDto,
  TransactionInput,
} from '@iplan/contracts'
import {
  type Month,
  type MonthlySummary,
  type RecurringRule,
  type Transaction,
  budgetUsage,
  linesForMonth,
  monthRange,
  parseMoney,
  summarizeMonth,
} from '@iplan/core'
import type { AuditLog } from '../../shared/audit'
import { type SessionUser, isAdmin } from '../../shared/context'
import { forbidden, notFound, validationFailed } from '../../shared/errors'
import { toCategoryDto, toRuleDto, toTransactionDto } from './finance.mapper'
import type { CategoryRow, FinanceRepository, RuleRow, TransactionRow } from './finance.repository'

/** Personal finance is kept in baht. */
export const FINANCE_CURRENCY = 'THB'
const MAX_OVERVIEW_MONTHS = 24

/** Built-in categories; names starting with "default:" are translated by the web app. */
const DEFAULT_CATEGORIES: { kind: 'income' | 'expense'; key: string; color: string }[] = [
  { kind: 'income', key: 'salary', color: '#16a34a' },
  { kind: 'income', key: 'bonus', color: '#0d9488' },
  { kind: 'income', key: 'other-income', color: '#64748b' },
  { kind: 'expense', key: 'food', color: '#f97316' },
  { kind: 'expense', key: 'transport', color: '#0ea5e9' },
  { kind: 'expense', key: 'bills', color: '#eab308' },
  { kind: 'expense', key: 'home', color: '#8b5cf6' },
  { kind: 'expense', key: 'shopping', color: '#ec4899' },
  { kind: 'expense', key: 'health', color: '#ef4444' },
  { kind: 'expense', key: 'fun', color: '#22c55e' },
  { kind: 'expense', key: 'other', color: '#94a3b8' },
]

const RESERVED_NAME = 'Names starting with "default:" are reserved'
const isBuiltInName = (name: string) => name.trim().toLowerCase().startsWith('default:')

/** Parses a baht amount; zero is only allowed where it means something (a month override). */
function amount(value: string, field: string, allowZero = false): bigint {
  let parsed: bigint
  try {
    parsed = parseMoney(value, FINANCE_CURRENCY).amount
  } catch (error) {
    throw validationFailed({ [field]: error instanceof Error ? error.message : 'Invalid amount' })
  }
  if (parsed < 0n || (!allowZero && parsed === 0n)) {
    throw validationFailed({ [field]: 'Amount must be above zero' })
  }
  return parsed
}

function monthBounds(month: Month): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y ?? 0, m ?? 1, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

const toSummaryDto = (s: MonthlySummary): MonthSummaryDto => ({
  month: s.month,
  grossIncomeMinor: s.grossIncome.toString(),
  deductionsMinor: s.deductions.toString(),
  netIncomeMinor: s.netIncome.toString(),
  fixedCostsMinor: s.fixedCosts.toString(),
  oneOffIncomeMinor: s.oneOffIncome.toString(),
  oneOffExpensesMinor: s.oneOffExpenses.toString(),
  totalIncomeMinor: s.totalIncome.toString(),
  totalExpensesMinor: s.totalExpenses.toString(),
  balanceMinor: s.balance.toString(),
})

const toCoreRule = (r: RuleRow): RecurringRule => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  amount: r.amountMinor,
  startMonth: r.startMonth as Month,
  ...(r.endMonth && { endMonth: r.endMonth as Month }),
  ...(r.categoryId && { categoryId: r.categoryId }),
})

const toCoreTransaction = (t: TransactionRow): Transaction => ({
  id: t.id,
  amount: t.amountMinor,
  kind: t.kind,
  month: t.date.slice(0, 7) as Month,
  ...(t.categoryId && { categoryId: t.categoryId }),
})

export class FinanceService {
  constructor(
    private readonly finance: FinanceRepository,
    private readonly audit: AuditLog,
  ) {}

  /** First visit creates the default categories. */
  private async categories(ownerId: string): Promise<CategoryRow[]> {
    const existing = await this.finance.categories(ownerId)
    if (existing.length > 0) return existing
    return this.finance.createCategories(
      DEFAULT_CATEGORIES.map((c, i) => ({
        ownerId,
        kind: c.kind,
        name: `default:${c.key}`,
        color: c.color,
        sortOrder: i,
      })),
    )
  }

  private async checkCategory(ownerId: string, categoryId: string | null | undefined) {
    if (!categoryId) return
    const all = await this.finance.categories(ownerId)
    if (!all.some((c) => c.id === categoryId))
      throw validationFailed({ categoryId: 'Unknown category' })
  }

  private async computeMonth(ownerId: string, month: Month, rules: RuleRow[]) {
    const { from, to } = monthBounds(month)
    const [overrides, transactions] = await Promise.all([
      this.finance.overrides(rules.map((r) => r.id)),
      this.finance.transactions(ownerId, from, to),
    ])
    const coreOverrides = overrides.map((o) => ({
      ruleId: o.ruleId,
      month: o.month as Month,
      amount: o.amountMinor,
      ...(o.note && { note: o.note }),
    }))
    const lines = linesForMonth(rules.map(toCoreRule), coreOverrides, month)
    const txs = transactions.map(toCoreTransaction)
    return { overrides, transactions, lines, txs, summary: summarizeMonth(lines, txs, month) }
  }

  /** An admin looking at someone's month (read-only, logged). */
  async monthOf(actor: SessionUser, ownerId: string, month: Month): Promise<MonthDto> {
    if (!isAdmin(actor)) throw forbidden('Admin only')
    if (!(await this.finance.userExists(ownerId))) throw notFound('User')
    await this.audit.record({
      actorId: actor.id,
      action: 'admin.view',
      entityType: 'finance',
      entityId: ownerId,
      data: { month },
    })
    // Looking must not write: no built-in categories are created for them.
    return this.month({ ...actor, id: ownerId }, month, true)
  }

  async month(actor: SessionUser, month: Month, readOnly = false): Promise<MonthDto> {
    const [categories, rules] = await Promise.all([
      readOnly ? this.finance.categories(actor.id) : this.categories(actor.id),
      this.finance.rules(actor.id),
    ])
    const { overrides, transactions, lines, txs, summary } = await this.computeMonth(
      actor.id,
      month,
      rules,
    )
    const notes = new Map(overrides.filter((o) => o.month === month).map((o) => [o.ruleId, o.note]))
    const budgets = budgetUsage(
      categories
        .filter((c) => c.kind === 'expense' && c.budgetMinor !== null)
        .map((c) => ({ categoryId: c.id, limit: c.budgetMinor ?? 0n })),
      lines,
      txs,
      month,
    )
    const spending = new Map<string | null, bigint>()
    for (const line of lines) {
      if (line.kind === 'fixed') {
        const key = line.categoryId ?? null
        spending.set(key, (spending.get(key) ?? 0n) + line.amount)
      }
    }
    for (const t of txs) {
      if (t.kind === 'expense') {
        const key = t.categoryId ?? null
        spending.set(key, (spending.get(key) ?? 0n) + t.amount)
      }
    }
    return {
      month,
      currency: FINANCE_CURRENCY,
      summary: toSummaryDto(summary),
      lines: lines.map((l) => ({
        ruleId: l.ruleId,
        kind: l.kind,
        name: l.name,
        amountMinor: l.amount.toString(),
        plannedMinor: l.planned.toString(),
        overridden: l.overridden,
        note: notes.get(l.ruleId) ?? null,
        categoryId: l.categoryId ?? null,
      })),
      transactions: transactions.map(toTransactionDto),
      categories: categories.map(toCategoryDto),
      budgets: budgets.map((b) => ({
        categoryId: b.categoryId,
        limitMinor: b.limit.toString(),
        spentMinor: b.spent.toString(),
        remainingMinor: b.remaining.toString(),
        ratio: Number.isFinite(b.ratio) ? b.ratio : 99,
        status: b.status,
      })),
      spendingByCategory: [...spending.entries()]
        .filter(([, v]) => v > 0n)
        .sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1))
        .map(([categoryId, spent]) => ({ categoryId, spentMinor: spent.toString() })),
    }
  }

  /** Month-by-month summaries for charts (at most two years). */
  async overview(actor: SessionUser, from: Month, to: Month): Promise<FinanceOverviewDto> {
    const months = monthRange(from, to)
    if (months.length === 0 || months.length > MAX_OVERVIEW_MONTHS) {
      throw validationFailed({ to: `Choose 1 to ${MAX_OVERVIEW_MONTHS} months` })
    }
    const rules = await this.finance.rules(actor.id)
    const first = monthBounds(months[0] as Month).from
    const last = monthBounds(months.at(-1) as Month).to
    const [overrides, transactions] = await Promise.all([
      this.finance.overrides(rules.map((r) => r.id)),
      this.finance.transactions(actor.id, first, last),
    ])
    const coreRules = rules.map(toCoreRule)
    const coreOverrides = overrides.map((o) => ({
      ruleId: o.ruleId,
      month: o.month as Month,
      amount: o.amountMinor,
    }))
    const txs = transactions.map(toCoreTransaction)
    return {
      currency: FINANCE_CURRENCY,
      months: months.map((m) =>
        toSummaryDto(summarizeMonth(linesForMonth(coreRules, coreOverrides, m), txs, m)),
      ),
    }
  }

  // --- Categories ---------------------------------------------------------

  async listCategories(actor: SessionUser): Promise<FinanceCategoryDto[]> {
    return (await this.categories(actor.id)).map(toCategoryDto)
  }

  async createCategory(
    actor: SessionUser,
    input: FinanceCategoryInput,
  ): Promise<FinanceCategoryDto> {
    if (isBuiltInName(input.name)) throw validationFailed({ name: RESERVED_NAME })
    const existing = await this.categories(actor.id)
    const row = await this.finance.createCategory({
      ownerId: actor.id,
      kind: input.kind,
      name: input.name,
      color: input.color,
      budgetMinor: input.budget ? amount(input.budget, 'budget') : null,
      sortOrder: existing.length,
    })
    return toCategoryDto(row)
  }

  async updateCategory(
    actor: SessionUser,
    id: string,
    input: FinanceCategoryInput,
  ): Promise<FinanceCategoryDto> {
    // A built-in keeps its "default:" name; nothing else may take one.
    if (isBuiltInName(input.name)) {
      const current = (await this.finance.categories(actor.id)).find((c) => c.id === id)
      if (!current) throw notFound('Category')
      if (current.name !== input.name) throw validationFailed({ name: RESERVED_NAME })
    }
    const row = await this.finance.updateCategory(id, actor.id, {
      kind: input.kind,
      name: input.name,
      color: input.color,
      ...(input.budget !== undefined && {
        budgetMinor: input.budget === null ? null : amount(input.budget, 'budget'),
      }),
    })
    if (!row) throw notFound('Category')
    return toCategoryDto(row)
  }

  async deleteCategory(actor: SessionUser, id: string): Promise<void> {
    if (!(await this.finance.deleteCategory(id, actor.id))) throw notFound('Category')
  }

  // --- Recurring rules ----------------------------------------------------

  async listRules(actor: SessionUser): Promise<RecurringRuleDto[]> {
    return (await this.finance.rules(actor.id)).map(toRuleDto)
  }

  private async ruleValues(actor: SessionUser, input: RecurringRuleInput) {
    if (input.endMonth && input.endMonth < input.startMonth) {
      throw validationFailed({ endMonth: 'End month must be on or after the start month' })
    }
    await this.checkCategory(actor.id, input.categoryId)
    return {
      ownerId: actor.id,
      kind: input.kind,
      name: input.name,
      amountMinor: amount(input.amount, 'amount'),
      startMonth: input.startMonth,
      endMonth: input.endMonth ?? null,
      categoryId: input.categoryId ?? null,
    }
  }

  async createRule(actor: SessionUser, input: RecurringRuleInput): Promise<RecurringRuleDto> {
    const row = await this.finance.createRule(await this.ruleValues(actor, input))
    await this.audit.record({
      actorId: actor.id,
      action: 'finance.rule.create',
      entityType: 'recurring_rule',
      entityId: row.id,
      data: { kind: row.kind },
    })
    return toRuleDto(row)
  }

  async updateRule(
    actor: SessionUser,
    id: string,
    input: RecurringRuleInput,
  ): Promise<RecurringRuleDto> {
    const row = await this.finance.updateRule(id, actor.id, await this.ruleValues(actor, input))
    if (!row) throw notFound('Rule')
    return toRuleDto(row)
  }

  async deleteRule(actor: SessionUser, id: string): Promise<void> {
    if (!(await this.finance.deleteRule(id, actor.id))) throw notFound('Rule')
  }

  private async ownRule(actor: SessionUser, ruleId: string) {
    const rule = (await this.finance.rules(actor.id)).find((r) => r.id === ruleId)
    if (!rule) throw notFound('Rule')
    return rule
  }

  /** Change one month only: a different amount, or skip it (amount null). */
  async setOverride(
    actor: SessionUser,
    ruleId: string,
    month: Month,
    input: OverrideInput,
  ): Promise<void> {
    await this.ownRule(actor, ruleId)
    await this.finance.setOverride({
      ruleId,
      month,
      amountMinor: input.amount === null ? null : amount(input.amount, 'amount', true),
      note: input.note ?? null,
    })
  }

  async clearOverride(actor: SessionUser, ruleId: string, month: Month): Promise<void> {
    await this.ownRule(actor, ruleId)
    await this.finance.clearOverride(ruleId, month)
  }

  // --- One-off transactions -------------------------------------------------

  private async transactionValues(actor: SessionUser, input: TransactionInput) {
    await this.checkCategory(actor.id, input.categoryId)
    return {
      ownerId: actor.id,
      kind: input.kind,
      title: input.title,
      amountMinor: amount(input.amount, 'amount'),
      date: input.date,
      categoryId: input.categoryId ?? null,
      note: input.note ?? null,
    }
  }

  async createTransaction(actor: SessionUser, input: TransactionInput): Promise<TransactionDto> {
    return toTransactionDto(
      await this.finance.createTransaction(await this.transactionValues(actor, input)),
    )
  }

  async updateTransaction(
    actor: SessionUser,
    id: string,
    input: TransactionInput,
  ): Promise<TransactionDto> {
    const row = await this.finance.updateTransaction(
      id,
      actor.id,
      await this.transactionValues(actor, input),
    )
    if (!row) throw notFound('Transaction')
    return toTransactionDto(row)
  }

  async deleteTransaction(actor: SessionUser, id: string): Promise<void> {
    if (!(await this.finance.deleteTransaction(id, actor.id))) throw notFound('Transaction')
  }
}
