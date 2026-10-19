import type { FinanceCategoryDto, RecurringRuleDto, TransactionDto } from '@iplan/contracts'
import type { CategoryRow, RuleRow, TransactionRow } from './finance.repository'

export const toCategoryDto = (row: CategoryRow): FinanceCategoryDto => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  color: row.color,
  budgetMinor: row.budgetMinor?.toString() ?? null,
})

export const toRuleDto = (row: RuleRow): RecurringRuleDto => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  amountMinor: row.amountMinor.toString(),
  startMonth: row.startMonth,
  endMonth: row.endMonth,
  categoryId: row.categoryId,
})

export const toTransactionDto = (row: TransactionRow): TransactionDto => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  amountMinor: row.amountMinor.toString(),
  date: row.date,
  categoryId: row.categoryId,
  note: row.note,
})
