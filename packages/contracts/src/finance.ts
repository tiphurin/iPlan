import { z } from 'zod'

const Month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM')
const Major = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 1500 or 1500.50')
const Minor = z.string().regex(/^-?\d+$/)
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const FinanceMonth = Month

export const FinanceCategoryKind = z.enum(['income', 'expense'])
export const RecurringKind = z.enum(['income', 'deduction', 'fixed'])
export type RecurringKind = z.infer<typeof RecurringKind>
export const TransactionKind = z.enum(['income', 'expense'])

export const FinanceCategoryDto = z.object({
  id: z.uuid(),
  kind: FinanceCategoryKind,
  name: z.string(),
  color: z.string(),
  budgetMinor: Minor.nullable(),
})
export type FinanceCategoryDto = z.infer<typeof FinanceCategoryDto>

export const FinanceCategoryInput = z.object({
  kind: FinanceCategoryKind,
  name: z.string().trim().min(1).max(40),
  color: Color.default('#94a3b8'),
  /** Monthly limit in baht; null removes it. */
  budget: Major.nullable().optional(),
})
export type FinanceCategoryInput = z.infer<typeof FinanceCategoryInput>

export const RecurringRuleDto = z.object({
  id: z.uuid(),
  kind: RecurringKind,
  name: z.string(),
  amountMinor: Minor,
  startMonth: Month,
  endMonth: Month.nullable(),
  categoryId: z.uuid().nullable(),
})
export type RecurringRuleDto = z.infer<typeof RecurringRuleDto>

export const RecurringRuleInput = z.object({
  kind: RecurringKind,
  name: z.string().trim().min(1).max(60),
  amount: Major,
  startMonth: Month,
  endMonth: Month.nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
})
export type RecurringRuleInput = z.infer<typeof RecurringRuleInput>

export const OverrideInput = z.object({
  /** New amount for this month only; null skips the rule this month. */
  amount: Major.nullable(),
  note: z.string().trim().max(200).nullable().optional(),
})
export type OverrideInput = z.infer<typeof OverrideInput>

export const TransactionDto = z.object({
  id: z.uuid(),
  kind: TransactionKind,
  title: z.string(),
  amountMinor: Minor,
  date: z.iso.date(),
  categoryId: z.uuid().nullable(),
  note: z.string().nullable(),
})
export type TransactionDto = z.infer<typeof TransactionDto>

export const TransactionInput = z.object({
  kind: TransactionKind,
  title: z.string().trim().min(1).max(80),
  amount: Major,
  date: z.iso.date(),
  categoryId: z.uuid().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
})
export type TransactionInput = z.infer<typeof TransactionInput>

export const MonthLineDto = z.object({
  ruleId: z.uuid(),
  kind: RecurringKind,
  name: z.string(),
  amountMinor: Minor,
  plannedMinor: Minor,
  overridden: z.boolean(),
  note: z.string().nullable(),
  categoryId: z.uuid().nullable(),
})
export type MonthLineDto = z.infer<typeof MonthLineDto>

export const MonthSummaryDto = z.object({
  month: Month,
  grossIncomeMinor: Minor,
  deductionsMinor: Minor,
  netIncomeMinor: Minor,
  fixedCostsMinor: Minor,
  oneOffIncomeMinor: Minor,
  oneOffExpensesMinor: Minor,
  totalIncomeMinor: Minor,
  totalExpensesMinor: Minor,
  balanceMinor: Minor,
})
export type MonthSummaryDto = z.infer<typeof MonthSummaryDto>

export const MonthDto = z.object({
  month: Month,
  currency: z.string(),
  summary: MonthSummaryDto,
  lines: z.array(MonthLineDto),
  transactions: z.array(TransactionDto),
  categories: z.array(FinanceCategoryDto),
  budgets: z.array(
    z.object({
      categoryId: z.uuid(),
      limitMinor: Minor,
      spentMinor: Minor,
      remainingMinor: Minor,
      ratio: z.number(),
      status: z.enum(['ok', 'warning', 'over']),
    }),
  ),
  /** Spending per category this month (fixed costs + one-off), for the donut. */
  spendingByCategory: z.array(z.object({ categoryId: z.uuid().nullable(), spentMinor: Minor })),
})
export type MonthDto = z.infer<typeof MonthDto>

export const FinanceOverviewDto = z.object({
  currency: z.string(),
  months: z.array(MonthSummaryDto),
})
export type FinanceOverviewDto = z.infer<typeof FinanceOverviewDto>
