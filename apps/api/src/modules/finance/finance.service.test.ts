import { beforeEach, describe, expect, it } from 'vitest'
import { FakeAudit, InMemoryFinance, users } from '../../testing/fakes'
import { FinanceService } from './finance.service'

describe('FinanceService', () => {
  let service: FinanceService

  beforeEach(async () => {
    service = new FinanceService(new InMemoryFinance(), new FakeAudit())
    for (const rule of [
      { kind: 'income' as const, name: 'Salary', amount: '50000' },
      { kind: 'deduction' as const, name: 'Withholding tax', amount: '2500' },
      { kind: 'deduction' as const, name: 'Social security', amount: '750' },
      { kind: 'deduction' as const, name: 'Provident fund 5%', amount: '2500' },
    ]) {
      await service.createRule(users.owner, { ...rule, startMonth: '2026-01' })
    }
  })

  it('creates default categories on first use', async () => {
    const categories = await service.listCategories(users.owner)
    expect(categories.map((c) => c.name)).toContain('default:salary')
    expect(categories.filter((c) => c.kind === 'expense')).toHaveLength(8)
  })

  it('builds a month from payslip lines, fixed costs and one-off spending', async () => {
    const home = (await service.listCategories(users.owner)).find((c) => c.name === 'default:home')
    await service.createRule(users.owner, {
      kind: 'fixed',
      name: 'Condo installment',
      amount: '12000',
      startMonth: '2026-03',
      endMonth: '2027-02',
      categoryId: home?.id ?? null,
    })
    await service.createTransaction(users.owner, {
      kind: 'expense',
      title: 'Dinner',
      amount: '850.50',
      date: '2026-10-05',
      categoryId: home?.id ?? null,
    })
    await service.updateCategory(users.owner, home?.id ?? '', {
      kind: 'expense',
      name: 'default:home',
      color: '#8b5cf6',
      budget: '12500',
    })
    const month = await service.month(users.owner, '2026-10')
    expect(month.summary).toMatchObject({
      grossIncomeMinor: '5000000',
      deductionsMinor: '575000',
      netIncomeMinor: '4425000',
      fixedCostsMinor: '1200000',
      oneOffExpensesMinor: '85050',
      balanceMinor: '3139950',
    })
    expect(month.budgets[0]).toMatchObject({ spentMinor: '1285050', status: 'over' })
    expect(month.spendingByCategory).toEqual([{ categoryId: home?.id, spentMinor: '1285050' }])
  })

  it('adjusts or skips one month without touching the others', async () => {
    const salary = (await service.listRules(users.owner)).find((r) => r.name === 'Salary')
    const tax = (await service.listRules(users.owner)).find((r) => r.name === 'Withholding tax')
    await service.setOverride(users.owner, salary?.id ?? '', '2026-12', {
      amount: '75000',
      note: 'Bonus month',
    })
    await service.setOverride(users.owner, tax?.id ?? '', '2026-12', { amount: null })
    const dec = await service.month(users.owner, '2026-12')
    expect(dec.lines.find((l) => l.name === 'Salary')).toMatchObject({
      amountMinor: '7500000',
      plannedMinor: '5000000',
      overridden: true,
      note: 'Bonus month',
    })
    expect(dec.lines.some((l) => l.name === 'Withholding tax')).toBe(false)
    expect((await service.month(users.owner, '2026-11')).summary.grossIncomeMinor).toBe('5000000')
    await service.clearOverride(users.owner, salary?.id ?? '', '2026-12')
    expect((await service.month(users.owner, '2026-12')).summary.grossIncomeMinor).toBe('5000000')
  })

  it('summarises a range of months for charts', async () => {
    const overview = await service.overview(users.owner, '2026-01', '2026-06')
    expect(overview.months).toHaveLength(6)
    expect(overview.months[0]?.netIncomeMinor).toBe('4425000')
    await expect(service.overview(users.owner, '2026-01', '2028-06')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
  })

  it("keeps each person's money private", async () => {
    const rule = (await service.listRules(users.owner))[0]
    expect(await service.listRules(users.editor)).toEqual([])
    await expect(
      service.setOverride(users.editor, rule?.id ?? '', '2026-10', { amount: null }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.deleteRule(users.editor, rule?.id ?? '')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('validates amounts, months and categories', async () => {
    await expect(
      service.createRule(users.owner, {
        kind: 'fixed',
        name: 'x',
        amount: '100',
        startMonth: '2026-05',
        endMonth: '2026-01',
      }),
    ).rejects.toMatchObject({ fields: { endMonth: expect.any(String) } })
    await expect(
      service.createTransaction(users.owner, {
        kind: 'expense',
        title: 'x',
        amount: '10',
        date: '2026-10-01',
        categoryId: '00000000-0000-4000-8000-00000000abcd',
      }),
    ).rejects.toMatchObject({ fields: { categoryId: 'Unknown category' } })
  })
})

describe('FinanceService amounts', () => {
  it('rejects zero for transactions and rules but allows a zero month override', async () => {
    const service = new FinanceService(new InMemoryFinance(), new FakeAudit())
    await expect(
      service.createTransaction(users.owner, {
        kind: 'expense',
        title: 'Nothing',
        amount: '0',
        date: '2026-10-03',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', fields: { amount: expect.any(String) } })
    await expect(
      service.createRule(users.owner, {
        kind: 'fixed',
        name: 'Phone',
        amount: '0.00',
        startMonth: '2026-10',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    const rule = await service.createRule(users.owner, {
      kind: 'fixed',
      name: 'Phone',
      amount: '599',
      startMonth: '2026-10',
    })
    // Zero for one month is a real choice (e.g. a free month); it must not throw.
    await service.setOverride(users.owner, rule.id, '2026-11', { amount: '0' })
  })
})

describe('FinanceService categories and admin view', () => {
  it('returns the category it just created and keeps "default:" names reserved', async () => {
    const service = new FinanceService(new InMemoryFinance(), new FakeAudit())
    await service.listCategories(users.owner)
    const created = await service.createCategory(users.owner, {
      kind: 'expense',
      name: 'Pets',
      color: '#123456',
      budget: '1500',
    })
    expect(created).toMatchObject({ name: 'Pets', color: '#123456', budgetMinor: '150000' })
    await expect(
      service.createCategory(users.owner, {
        kind: 'expense',
        name: 'default:food',
        color: '#123456',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', fields: { name: expect.any(String) } })
    await expect(
      service.updateCategory(users.owner, created.id, {
        kind: 'expense',
        name: 'Default:home',
        color: '#123456',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it("lets an admin read someone's month without writing, and 404s for nobody", async () => {
    const repo = new InMemoryFinance()
    const service = new FinanceService(repo, new FakeAudit())
    const admin = { ...users.viewer, role: 'admin' as const }
    const month = await service.monthOf(admin, users.editor.id, '2026-10')
    expect(month.categories).toEqual([])
    expect(repo.cats).toEqual([])
    await expect(service.monthOf(admin, 'nobody', '2026-10')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
