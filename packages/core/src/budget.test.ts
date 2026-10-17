import { describe, expect, it } from 'vitest'
import {
  type RecurringRule,
  addMonths,
  budgetUsage,
  linesForMonth,
  monthRange,
  parseMonth,
  summarizeMonth,
} from './budget'

const rules: RecurringRule[] = [
  { id: 'salary', kind: 'income', name: 'Salary', amount: 5_000_000n, startMonth: '2026-01' },
  {
    id: 'tax',
    kind: 'deduction',
    name: 'Withholding tax',
    amount: 300_000n,
    startMonth: '2026-01',
  },
  { id: 'sso', kind: 'deduction', name: 'Social security', amount: 75_000n, startMonth: '2026-01' },
  {
    id: 'condo',
    kind: 'fixed',
    name: 'Condo installment',
    amount: 1_200_000n,
    startMonth: '2026-03',
    endMonth: '2026-12',
    categoryId: 'home',
  },
  {
    id: 'phone',
    kind: 'fixed',
    name: 'Phone',
    amount: 59_900n,
    startMonth: '2026-01',
    categoryId: 'bills',
  },
]

describe('months', () => {
  it('parses and steps months across years', () => {
    expect(parseMonth('2026-10')).toBe('2026-10')
    expect(() => parseMonth('2026-13')).toThrow()
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(monthRange('2026-11', '2027-01')).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(monthRange('2027-01', '2026-01')).toEqual([])
  })
})

describe('linesForMonth', () => {
  it('applies rules active in the month', () => {
    expect(linesForMonth(rules, [], '2026-02').map((l) => l.ruleId)).toEqual([
      'salary',
      'tax',
      'sso',
      'phone',
    ])
    expect(linesForMonth(rules, [], '2027-01').some((l) => l.ruleId === 'condo')).toBe(false)
  })

  it('applies per-month overrides and skips', () => {
    const lines = linesForMonth(
      rules,
      [
        { ruleId: 'salary', month: '2026-10', amount: 5_500_000n, note: 'bonus month' },
        { ruleId: 'phone', month: '2026-10', amount: null },
        { ruleId: 'tax', month: '2026-09', amount: 0n },
      ],
      '2026-10',
    )
    const salary = lines.find((l) => l.ruleId === 'salary')
    expect(salary).toMatchObject({ amount: 5_500_000n, planned: 5_000_000n, overridden: true })
    expect(lines.some((l) => l.ruleId === 'phone')).toBe(false)
    expect(lines.find((l) => l.ruleId === 'tax')?.overridden).toBe(false)
  })
})

describe('summarizeMonth', () => {
  it('separates income, deductions, fixed and one-off spending', () => {
    const month = '2026-10'
    const summary = summarizeMonth(
      linesForMonth(rules, [], month),
      [
        { id: 't1', amount: 250_000n, kind: 'expense', month, categoryId: 'food' },
        { id: 't2', amount: 100_000n, kind: 'income', month },
        { id: 't3', amount: 999_999n, kind: 'expense', month: '2026-09' },
      ],
      month,
    )
    expect(summary).toEqual({
      month,
      grossIncome: 5_000_000n,
      deductions: 375_000n,
      netIncome: 4_625_000n,
      fixedCosts: 1_259_900n,
      oneOffIncome: 100_000n,
      oneOffExpenses: 250_000n,
      totalIncome: 4_725_000n,
      totalExpenses: 1_509_900n,
      balance: 3_215_100n,
    })
  })
})

describe('budgetUsage', () => {
  it('flags categories near or over budget', () => {
    const month = '2026-10'
    const usage = budgetUsage(
      [
        { categoryId: 'food', limit: 1_000_000n },
        { categoryId: 'bills', limit: 70_000n },
        { categoryId: 'home', limit: 1_000_000n },
        { categoryId: 'fun', limit: 0n },
      ],
      linesForMonth(rules, [], month),
      [{ id: 't1', amount: 250_000n, kind: 'expense', month, categoryId: 'food' }],
      month,
    )
    expect(usage.map((u) => [u.categoryId, u.status])).toEqual([
      ['food', 'ok'],
      ['bills', 'warning'],
      ['home', 'over'],
      ['fun', 'ok'],
    ])
    expect(usage[0]).toMatchObject({ spent: 250_000n, remaining: 750_000n, ratio: 0.25 })
  })
})
