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
  return { tripId, service, repo }
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
    await service.addContribution(users.owner, tripId, {
      userId: 'owner',
      amount: '90',
      currency: 'THB',
    })
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
    expect(net).toEqual({ owner: '26000', editor: '-13000', viewer: '-13000' })
    // The 300 owner paid is settled between people; the 90 from the pool with the pool.
    const owed = summary.transfers.reduce((sum, t) => sum + BigInt(t.amountMinor), 0n)
    expect(owed).toBe(20000n)
    expect(summary.pool.map((m) => [m.userId, m.netMinor])).toEqual([
      ['owner', '6000'],
      ['editor', '-3000'],
      ['viewer', '-3000'],
    ])
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
    const { body: csv, fileName } = await service.csv(users.viewer, tripId)
    expect(fileName).toMatch(/\.csv$/)
    const th = await service.csv(users.viewer, tripId, 'th')
    expect(th.body).toContain('วันที่,รายการ,หมวด')
    expect(csv.startsWith('﻿Date,Title')).toBe(true)
    expect(csv).toContain('Owner (THB)')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('892.50')
  })

  it('keeps people who left the trip on expenses they were already part of', async () => {
    const { tripId, service, repo } = await setup()
    const e = await service.create(users.owner, tripId, {
      ...meal,
      paidBy: 'editor',
      split: { mode: 'exact', shares: { owner: '20000', editor: '15000' } },
    })
    repo.roles.get(tripId)?.delete('editor')
    const edited = await service.update(users.owner, e.id, {
      ...meal,
      title: 'Late dinner',
      paidBy: 'editor',
      split: { mode: 'exact', shares: { owner: '20000', editor: '15000' } },
    })
    expect(edited).toMatchObject({ title: 'Late dinner', paidBy: 'editor' })
    expect(edited.shares.map((s) => s.userId)).toEqual(['owner', 'editor'])
    // Someone who was never on it still has to be a member.
    await expect(
      service.update(users.owner, e.id, {
        ...meal,
        split: { mode: 'equal', participants: ['owner', 'stranger'] },
      }),
    ).rejects.toMatchObject({ fields: { split: expect.any(String) } })
    await expect(
      service.update(users.owner, e.id, { ...meal, paidBy: 'stranger' }),
    ).rejects.toMatchObject({ fields: { paidBy: 'Not a trip member' } })
    // A new expense can't add the former member.
    await expect(
      service.create(users.owner, tripId, { ...meal, paidBy: 'editor' }),
    ).rejects.toMatchObject({ fields: { paidBy: 'Not a trip member' } })
  })

  it('replaces saved rates, so a rate can be removed', async () => {
    const { tripId, service, repo } = await setup()
    await service.updateMoneySettings(users.owner, tripId, {
      fxRates: { KRW: '0.0255', JPY: '0.23', THB: '1' },
    })
    expect(repo.trips.get(tripId)?.fxRates).toEqual({ KRW: '0.0255', JPY: '0.23' })
    await service.updateMoneySettings(users.owner, tripId, { fxRates: { JPY: '0.24' } })
    expect(repo.trips.get(tripId)?.fxRates).toEqual({ JPY: '0.24' })
    // Leaving fxRates out keeps them.
    await service.updateMoneySettings(users.owner, tripId, { dailyBudget: null })
    expect(repo.trips.get(tripId)?.fxRates).toEqual({ JPY: '0.24' })
  })
})
