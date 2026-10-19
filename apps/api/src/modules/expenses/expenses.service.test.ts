import { describe, expect, it } from 'vitest'
import { InMemoryExpenses, seededTrip, users } from '../../testing/fakes'
import { ExpensesService } from './expenses.service'

async function setup() {
  const { tripId, trips, repo, audit } = await seededTrip()
  const service = new ExpensesService(new InMemoryExpenses(repo), trips, repo, audit)
  await service.updateMoneySettings(users.owner, tripId, {
    fxRates: { KRW: '0.0255' },
    dailyBudget: '3000',
  })
  return { tripId, service }
}

const meal = {
  dayDate: '2026-10-23',
  title: 'Dinner',
  category: 'food' as const,
  amount: '35000',
  currency: 'KRW',
  paidBy: 'owner',
  split: { mode: 'equal' as const, participants: ['owner', 'editor'] },
}

describe('ExpensesService', () => {
  it('converts to the base currency with the saved rate and splits equally', async () => {
    const { tripId, service } = await setup()
    const e = await service.create(users.editor, tripId, meal)
    expect(e).toMatchObject({
      amountMinor: '35000',
      fxRate: '0.0255',
      baseAmountMinor: '89250',
      paidByName: 'Owner',
    })
    expect(e.shares.map((s) => [s.userId, s.amountMinor, s.baseAmountMinor])).toEqual([
      ['owner', '17500', '44625'],
      ['editor', '17500', '44625'],
    ])
  })

  it('supports exact amounts (2,000 meal: A pays 1,500) and percentages', async () => {
    const { tripId, service } = await setup()
    const exact = await service.create(users.owner, tripId, {
      ...meal,
      amount: '2000',
      currency: 'THB',
      split: { mode: 'exact', shares: { owner: '1500', editor: '500' } },
    })
    expect(exact.shares.map((s) => s.baseAmountMinor)).toEqual(['150000', '50000'])
    await expect(
      service.create(users.owner, tripId, {
        ...meal,
        split: { mode: 'exact', shares: { owner: '100', editor: '100' } },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', fields: { split: expect.any(String) } })
    const pct = await service.create(users.owner, tripId, {
      ...meal,
      amount: '1000',
      currency: 'THB',
      split: { mode: 'percent', shares: { owner: 70, editor: 30 } },
    })
    expect(pct.shares.map((s) => [s.amountMinor, s.percentBp])).toEqual([
      ['70000', 7000],
      ['30000', 3000],
    ])
  })

  it('works out who owes whom, including the shared pool', async () => {
    const { tripId, service } = await setup()
    await service.create(users.owner, tripId, {
      ...meal,
      amount: '300',
      currency: 'THB',
      split: { mode: 'equal', participants: ['owner', 'editor', 'viewer'] },
    })
    await service.create(users.owner, tripId, {
      ...meal,
      amount: '90',
      currency: 'THB',
      paidBy: 'pool',
      split: { mode: 'equal', participants: ['owner', 'editor', 'viewer'] },
    })
    const summary = await service.summary(users.viewer, tripId)
    expect(summary.totalMinor).toBe('39000')
    const net = Object.fromEntries(summary.parties.map((p) => [p.id, p.netMinor]))
    expect(net).toEqual({ owner: '17000', editor: '-13000', viewer: '-13000', pool: '9000' })
    const owed = summary.transfers.reduce((sum, t) => sum + BigInt(t.amountMinor), 0n)
    expect(owed).toBe(26000n)
    expect(summary.byDay.find((d) => d.dayDate === '2026-10-23')).toEqual({
      dayDate: '2026-10-23',
      spentMinor: '39000',
      budgetMinor: '300000',
    })
    expect(summary.byCategory).toEqual([{ category: 'food', spentMinor: '39000' }])
  })

  it('validates members, rates, amounts and days', async () => {
    const { tripId, service } = await setup()
    await expect(
      service.create(users.owner, tripId, { ...meal, currency: 'JPY' }),
    ).rejects.toMatchObject({
      fields: { fxRate: 'No exchange rate saved for JPY' },
    })
    await expect(
      service.create(users.owner, tripId, { ...meal, amount: '10.5' }),
    ).rejects.toMatchObject({
      fields: { amount: expect.stringContaining('decimal') },
    })
    await expect(
      service.create(users.owner, tripId, { ...meal, paidBy: 'stranger' }),
    ).rejects.toMatchObject({
      fields: { paidBy: 'Not a trip member' },
    })
    await expect(
      service.create(users.owner, tripId, {
        ...meal,
        split: { mode: 'equal', participants: ['stranger'] },
      }),
    ).rejects.toMatchObject({ fields: { split: expect.any(String) } })
    await expect(
      service.create(users.owner, tripId, { ...meal, dayDate: '2026-12-01' }),
    ).rejects.toMatchObject({
      fields: { dayDate: expect.any(String) },
    })
    await expect(service.create(users.viewer, tripId, meal)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('exports CSV with a BOM, per-person columns and formula-safe cells', async () => {
    const { tripId, service } = await setup()
    await service.create(users.owner, tripId, { ...meal, title: '=HYPERLINK("x")' })
    const csv = await service.csv(users.viewer, tripId)
    expect(csv.startsWith('﻿Date,Title')).toBe(true)
    expect(csv).toContain('Owner (THB)')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('892.50')
  })
})
