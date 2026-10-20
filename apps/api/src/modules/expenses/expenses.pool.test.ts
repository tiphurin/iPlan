import { PoolContributionInput } from '@iplan/contracts'
import { describe, expect, it } from 'vitest'
import { InMemoryExpenses, seededTrip, users } from '../../testing/fakes'
import { ExpensesService } from './expenses.service'

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
  it('actual mode: whoever put in more than they used gets it back', async () => {
    const { tripId, service } = await example()
    const summary = await service.summary(users.viewer, tripId)
    expect(summary.poolMode).toBe('actual')
    expect(netOf(summary)).toEqual({ owner: '200000', editor: '0', viewer: '0', pool: '-200000' })
    expect(transfersOf(summary)).toEqual([['pool', 'owner', '200000']])
    const owner = summary.parties.find((p) => p.id === 'owner')
    expect(owner).toMatchObject({ contributedMinor: '700000', shareMinor: '500000' })

    const pool = await service.pool(users.viewer, tripId)
    expect(pool).toMatchObject({
      mode: 'actual',
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

  it('proportional mode: shares spending and the leftover by what each put in', async () => {
    const { tripId, service, audit } = await example()
    const pool = await service.setPoolMode(users.editor, tripId, 'proportional')
    expect(pool.mode).toBe('proportional')
    expect(audit.entries.at(-1)).toMatchObject({
      action: 'trip.pool_mode',
      data: { mode: 'proportional' },
    })
    const summary = await service.summary(users.viewer, tripId)
    // Owner: 7/12 of 10,000 = 5,833.33 → 1,166.67 back. Editor: 4,166.67 → 833.33 back.
    expect(netOf(summary)).toEqual({
      owner: '116667',
      editor: '83333',
      viewer: '0',
      pool: '-200000',
    })
    expect(transfersOf(summary)).toEqual([
      ['pool', 'owner', '116667'],
      ['pool', 'editor', '83333'],
    ])
    expect(summary.parties.find((p) => p.id === 'owner')?.shareMinor).toBe('583333')
    // Switching back recomputes live.
    await service.setPoolMode(users.owner, tripId, 'actual')
    expect(transfersOf(await service.summary(users.viewer, tripId))).toEqual([
      ['pool', 'owner', '200000'],
    ])
  })

  it('shares a shortfall by the normal split (actual) or by proportion', async () => {
    const { tripId, service } = await example()
    await service.create(users.owner, tripId, poolSpend('4000'))
    // Spent 14,000 from 12,000: each used 7,000, so Editor owes the pool 2,000.
    expect(netOf(await service.summary(users.viewer, tripId))).toEqual({
      owner: '0',
      editor: '-200000',
      viewer: '0',
      pool: '200000',
    })
    expect((await service.pool(users.viewer, tripId)).leftoverBaseMinor).toBe('-200000')
    await service.setPoolMode(users.owner, tripId, 'proportional')
    // 2,000 short split 7:5; each expense rounds to the satang on its own.
    expect(netOf(await service.summary(users.viewer, tripId))).toEqual({
      owner: '-116666',
      editor: '-83334',
      viewer: '0',
      pool: '200000',
    })
  })

  it('falls back to each expense split when nobody has put money in', async () => {
    const { tripId, service } = await setup()
    await service.setPoolMode(users.owner, tripId, 'proportional')
    await service.create(users.owner, tripId, poolSpend('100'))
    expect(netOf(await service.summary(users.viewer, tripId))).toEqual({
      owner: '-5000',
      editor: '-5000',
      viewer: '0',
      pool: '10000',
    })
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
    await expect(service.setPoolMode(users.viewer, tripId, 'proportional')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
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
    expect(transfersOf(await service.summary(users.viewer, tripId))).toEqual([
      ['pool', 'owner', '200000'],
    ])
  })

  it('the CSV export lists the pool: each contribution, each person, totals and the rule', async () => {
    const { tripId, service } = await example()
    const csv = await service.csv(users.viewer, tripId)
    expect(csv).toContain('Pool,"Rule: split as used, overpayment refunded"')
    expect(csv).toContain('Put in by')
    expect(csv).toMatch(/Owner,7000\.00,THB,1,7000\.00/)
    expect(csv).toContain('58.3%')
    expect(csv).toContain('Total put in,,,,,12000.00')
    expect(csv).toContain('Left over (negative = short),,,,,2000.00')
    await service.setPoolMode(users.owner, tripId, 'proportional')
    expect(await service.csv(users.viewer, tripId)).toContain('Rule: proportional')
  })

  it('the CSV has no pool part for a trip without a pool', async () => {
    const { tripId, service } = await setup()
    expect(await service.csv(users.viewer, tripId)).not.toContain('Pool')
  })

  it('locks the trip currency once money is in the pool', async () => {
    const { tripId, service, trips } = await setup()
    await service.addContribution(users.owner, tripId, put('owner', '100'))
    await expect(trips.update(users.owner, tripId, { baseCurrency: 'USD' })).rejects.toMatchObject({
      code: 'TRIP_CURRENCY_LOCKED',
    })
  })
})
