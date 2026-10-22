import { PoolContributionInput } from '@iplan/contracts'
import { describe, expect, it } from 'vitest'
import { InMemoryExpenses, seededTrip, users } from '../../testing/fakes'
import { ExpensesService, safeFileName } from './expenses.service'

async function setup() {
  const { tripId, trips, repo, audit } = await seededTrip()
  const store = new InMemoryExpenses(repo)
  repo.linked.expenses = store
  const service = new ExpensesService(store, trips, repo, audit)
  await service.updateMoneySettings(users.owner, tripId, { fxRates: { KRW: '0.0255' } })
  return { tripId, service, repo, audit, trips }
}

const put = (userId: string, amount: string) => ({ userId, amount, currency: 'THB' })
const poolSpend = (amount: string) => ({
  dayDate: '2026-10-23',
  title: 'Shared',
  category: 'food' as const,
  amount,
  currency: 'THB',
  paidBy: 'pool',
  split: { mode: 'equal' as const, participants: ['owner', 'editor'] },
})

/** Owner puts in ฿7,000, Editor ฿5,000, the pool spends ฿10,000 split equally. */
async function example() {
  const ctx = await setup()
  await ctx.service.addContribution(users.owner, ctx.tripId, put('owner', '7000'))
  await ctx.service.addContribution(users.editor, ctx.tripId, put('editor', '5000'))
  await ctx.service.create(users.owner, ctx.tripId, poolSpend('6000'))
  await ctx.service.create(users.owner, ctx.tripId, poolSpend('4000'))
  return ctx
}

const netOf = (summary: { parties: { id: string; netMinor: string }[] }) =>
  Object.fromEntries(summary.parties.map((p) => [p.id, p.netMinor]))
const transfersOf = (summary: { transfers: { from: string; to: string; amountMinor: string }[] }) =>
  summary.transfers.map((t) => [t.from, t.to, t.amountMinor])

describe('ExpensesService pool', () => {
  it('everyone pays what they used: put in more than used, get the rest back', async () => {
    const { tripId, service } = await example()
    const summary = await service.summary(users.viewer, tripId)
    expect(netOf(summary)).toEqual({ owner: '200000', editor: '0', viewer: '0' })
    expect(summary.pool).toEqual([
      {
        userId: 'owner',
        name: 'Owner',
        contributedMinor: '700000',
        usedMinor: '500000',
        netMinor: '200000',
      },
      {
        userId: 'editor',
        name: 'Editor',
        contributedMinor: '500000',
        usedMinor: '500000',
        netMinor: '0',
      },
    ])
    // Pool-paid spending is settled with the pool, not between people.
    expect(summary.transfers).toEqual([])
    const owner = summary.parties.find((p) => p.id === 'owner')
    expect(owner).toMatchObject({ contributedMinor: '700000', shareMinor: '500000' })

    const pool = await service.pool(users.viewer, tripId)
    expect(pool).toMatchObject({
      baseCurrency: 'THB',
      totalBaseMinor: '1200000',
      spentBaseMinor: '1000000',
      leftoverBaseMinor: '200000',
      byMember: [
        { userId: 'owner', name: 'Owner', contributedBaseMinor: '700000', percentBp: 5833 },
        { userId: 'editor', name: 'Editor', contributedBaseMinor: '500000', percentBp: 4167 },
      ],
    })
    expect(pool.contributions).toHaveLength(2)
  })

  it('someone who used the pool without putting in pays their part into it', async () => {
    const { tripId, service } = await setup()
    await service.addContribution(users.owner, tripId, put('owner', '3000'))
    await service.create(users.owner, tripId, {
      ...poolSpend('1800'),
      split: { mode: 'equal', participants: ['owner', 'editor', 'viewer'] },
    })
    const summary = await service.summary(users.viewer, tripId)
    expect(summary.pool.map((m) => [m.userId, m.netMinor])).toEqual([
      ['owner', '240000'],
      ['editor', '-60000'],
      ['viewer', '-60000'],
    ])
  })

  it('never lets the pool go below zero', async () => {
    const { tripId, service } = await example()
    // 2,000 left: a 4,000 pool payment is refused, a 2,000 one fits exactly.
    await expect(service.create(users.owner, tripId, poolSpend('4000'))).rejects.toMatchObject({
      code: 'POOL_SHORT',
      status: 422,
    })
    const exact = await service.create(users.owner, tripId, poolSpend('2000'))
    // Raising it, or taking money out, would now go below zero.
    await expect(service.update(users.owner, exact.id, poolSpend('2001'))).rejects.toMatchObject({
      code: 'POOL_SHORT',
    })
    const [first] = (await service.pool(users.viewer, tripId)).contributions
    await expect(service.removeContribution(users.owner, first?.id ?? '')).rejects.toMatchObject({
      code: 'POOL_SHORT',
    })
    await expect(
      service.updateContribution(users.owner, first?.id ?? '', { amount: '6999' }),
    ).rejects.toMatchObject({ code: 'POOL_SHORT' })
    // Lowering a pool payment or paying it yourself is always fine.
    await service.update(users.owner, exact.id, poolSpend('1000'))
    await service.update(users.owner, exact.id, { ...poolSpend('9000'), paidBy: 'owner' })
    expect((await service.pool(users.viewer, tripId)).leftoverBaseMinor).toBe('200000')
    // An empty pool cannot pay at all.
    const empty = await setup()
    await expect(
      empty.service.create(users.owner, empty.tripId, poolSpend('1')),
    ).rejects.toMatchObject({ code: 'POOL_SHORT' })
  })

  it('people pay whoever paid for them, netted per pair, with the expenses behind it', async () => {
    const { tripId, service } = await setup()
    const all = ['owner', 'editor', 'viewer']
    const hotel = await service.create(users.owner, tripId, {
      ...poolSpend('3000'),
      title: 'Hotel',
      paidBy: 'owner',
      split: { mode: 'equal', participants: all },
    })
    const dinner = await service.create(users.owner, tripId, {
      ...poolSpend('1500'),
      title: 'Dinner',
      paidBy: 'editor',
      split: { mode: 'equal', participants: all },
    })
    const summary = await service.summary(users.viewer, tripId)
    expect(transfersOf(summary)).toEqual([
      ['viewer', 'owner', '100000'],
      ['editor', 'owner', '50000'],
      ['viewer', 'editor', '50000'],
    ])
    expect(summary.transfers[1]?.items).toEqual([
      { expenseId: hotel.id, title: 'Hotel', amountMinor: '100000' },
      { expenseId: dinner.id, title: 'Dinner', amountMinor: '-50000' },
    ])
    expect(summary.pool).toEqual([])
  })

  it('converts other currencies with the given or saved rate, and needs one', async () => {
    const { tripId, service } = await setup()
    const krw = await service.addContribution(users.owner, tripId, {
      userId: 'editor',
      amount: '100000',
      currency: 'KRW',
      date: '2026-10-20',
      note: 'ATM',
    })
    expect(krw).toMatchObject({
      name: 'Editor',
      amountMinor: '100000',
      fxRate: '0.0255',
      baseAmountMinor: '255000',
      date: '2026-10-20',
      note: 'ATM',
    })
    const usd = await service.addContribution(users.owner, tripId, {
      ...put('owner', '10'),
      currency: 'USD',
      fxRate: '35.5',
    })
    expect(usd.baseAmountMinor).toBe('35500')
    await expect(
      service.addContribution(users.owner, tripId, { ...put('owner', '10'), currency: 'JPY' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { fxRate: 'No exchange rate saved for JPY' },
    })
  })

  it('validates amounts and members', async () => {
    const { tripId, service } = await setup()
    await expect(
      service.addContribution(users.owner, tripId, put('owner', '0')),
    ).rejects.toMatchObject({ fields: { amount: 'Amount must be above zero' } })
    await expect(
      service.addContribution(users.owner, tripId, put('owner', '1.005')),
    ).rejects.toMatchObject({ fields: { amount: expect.any(String) } })
    await expect(
      service.addContribution(users.owner, tripId, put('stranger', '100')),
    ).rejects.toMatchObject({ fields: { userId: 'Not a trip member' } })
    // Negative and huge amounts never reach the service.
    expect(PoolContributionInput.safeParse(put('owner', '-5')).success).toBe(false)
    expect(PoolContributionInput.safeParse(put('owner', '1234567890123')).success).toBe(false)
    expect(PoolContributionInput.safeParse(put('owner', '999999999999')).success).toBe(true)
  })

  it('lets editors and owners write, viewers only read, strangers nothing', async () => {
    const { tripId, service, audit } = await setup()
    const c = await service.addContribution(users.editor, tripId, put('viewer', '300'))
    expect(audit.entries.at(-1)).toMatchObject({
      action: 'pool.contribute',
      entityId: c.id,
      data: { tripId, userId: 'viewer', amount: '300' },
    })
    await expect(
      service.addContribution(users.viewer, tripId, put('viewer', '1')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      service.updateContribution(users.viewer, c.id, { amount: '1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.removeContribution(users.viewer, c.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(service.pool(users.stranger, tripId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      service.addContribution(users.stranger, tripId, put('owner', '1')),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.removeContribution(users.stranger, c.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      service.removeContribution(users.owner, '00000000-0000-4000-8000-999999999999'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect((await service.pool(users.viewer, tripId)).totalBaseMinor).toBe('30000')
  })

  it('edits keep the stored rate and other fields; deleting recomputes the balances', async () => {
    const { tripId, service, repo, audit } = await example()
    const krw = await service.addContribution(users.owner, tripId, {
      ...put('owner', '100000'),
      currency: 'KRW',
    })
    // A later rate change does not touch money already put in.
    await service.updateMoneySettings(users.owner, tripId, { fxRates: { KRW: '0.03' } })
    const edited = await service.updateContribution(users.owner, krw.id, { note: 'Cash' })
    expect(edited).toMatchObject({ fxRate: '0.0255', baseAmountMinor: '255000', note: 'Cash' })
    const moved = await service.updateContribution(users.owner, krw.id, {
      amount: '2550',
      currency: 'THB',
    })
    expect(moved).toMatchObject({ fxRate: '1', baseAmountMinor: '255000', note: 'Cash' })
    expect(audit.entries.at(-1)).toMatchObject({ action: 'pool.update', entityId: krw.id })

    // Someone who left may stay on their own contribution, but can't be added again.
    repo.roles.get(tripId)?.delete('editor')
    const [, editorRow] = (await service.pool(users.owner, tripId)).contributions
    if (!editorRow) throw new Error('missing contribution')
    await expect(
      service.updateContribution(users.owner, editorRow.id, { amount: '5100' }),
    ).resolves.toMatchObject({ baseAmountMinor: '510000', name: 'Former member' })
    await expect(
      service.updateContribution(users.owner, krw.id, { userId: 'editor' }),
    ).rejects.toMatchObject({ fields: { userId: 'Not a trip member' } })
    repo.roles.get(tripId)?.set('editor', 'editor')
    await service.updateContribution(users.owner, editorRow.id, { amount: '5000' })

    await service.removeContribution(users.owner, krw.id)
    expect(audit.entries.at(-1)).toMatchObject({ action: 'pool.delete', entityId: krw.id })
    const after = await service.summary(users.viewer, tripId)
    expect(after.pool.find((m) => m.userId === 'owner')?.netMinor).toBe('200000')
  })

  it('the CSV export lists the pool: each contribution, each person and totals', async () => {
    const { tripId, service } = await example()
    const { body: csv } = await service.csv(users.viewer, tripId)
    expect(csv).toContain('\r\nPool\r\n')
    expect(csv).toContain('Put in by')
    expect(csv).toMatch(/Owner,7000\.00,THB,1,7000\.00/)
    expect(csv).toContain('58.3%')
    expect(csv).toContain('Total put in,,,,,12000.00')
    expect(csv).toContain('Left over (negative = short),,,,,2000.00')
  })

  it('names the CSV after the trip, safe for any system', () => {
    expect(safeFileName('Seoul 2026 / ทริป: "แม่"?')).toBe('Seoul 2026 ทริป แม่')
    expect(safeFileName('   ')).toBe('trip')
  })

  it('the CSV has no pool part for a trip without a pool', async () => {
    const { tripId, service } = await setup()
    expect((await service.csv(users.viewer, tripId)).body).not.toContain('Pool')
  })

  it('locks the trip currency once money is in the pool', async () => {
    const { tripId, service, trips } = await setup()
    await service.addContribution(users.owner, tripId, put('owner', '100'))
    await expect(trips.update(users.owner, tripId, { baseCurrency: 'USD' })).rejects.toMatchObject({
      code: 'TRIP_CURRENCY_LOCKED',
    })
  })
})
