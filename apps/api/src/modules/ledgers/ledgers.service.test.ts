import { describe, expect, it } from 'vitest'
import { FakeAudit, InMemoryLedgers, users } from '../../testing/fakes'
import { LedgersService } from './ledgers.service'

const me = users.owner
const partner = users.editor

async function couple() {
  const repo = new InMemoryLedgers()
  const service = new LedgersService(repo, new FakeAudit())
  const ledger = await service.create(me, { name: 'Home', currency: 'THB' })
  await service.addMember(me, ledger.id, partner.email)
  return { repo, service, id: ledger.id }
}

describe('LedgersService', () => {
  it('splits a 2,000 dinner where I paid and chose to cover 1,500', async () => {
    const { service, id } = await couple()
    const entry = await service.addEntry(me, id, {
      title: 'Dinner',
      category: 'food',
      amount: '2000',
      date: '2026-10-19',
      paidBy: me.id,
      split: { mode: 'exact', shares: { [me.id]: '1500', [partner.id]: '500' } },
    })
    expect(entry.shares.map((s) => [s.userId, s.amountMinor])).toEqual([
      [me.id, '150000'],
      [partner.id, '50000'],
    ])
    const detail = await service.get(me, id)
    expect(detail.myBalanceMinor).toBe('50000')
    expect(detail.transfers).toEqual([{ from: partner.id, to: me.id, amountMinor: '50000' }])
    expect(detail.months).toEqual([
      { month: '2026-10', totalMinor: '200000', myShareMinor: '150000' },
    ])
    expect((await service.get(partner, id)).myBalanceMinor).toBe('-50000')
  })

  it('settles up and drops back to zero', async () => {
    const { service, id } = await couple()
    await service.addEntry(me, id, {
      title: 'Groceries',
      category: 'groceries',
      amount: '900',
      date: '2026-10-18',
      paidBy: partner.id,
      split: { mode: 'percent', shares: { [me.id]: 60, [partner.id]: 40 } },
    })
    expect((await service.get(me, id)).myBalanceMinor).toBe('-54000')
    await service.settleUp(me, id, {
      from: me.id,
      to: partner.id,
      amount: '540',
      date: '2026-10-19',
    })
    const detail = await service.get(me, id)
    expect(detail.myBalanceMinor).toBe('0')
    expect(detail.transfers).toEqual([])
    // Settlements are not spending.
    expect(detail.months[0]?.totalMinor).toBe('90000')
  })

  it('rejects shares that do not add up and strangers in the split', async () => {
    const { service, id } = await couple()
    const base = { title: 'X', category: 'other' as const, amount: '100', date: '2026-10-19' }
    await expect(
      service.addEntry(me, id, {
        ...base,
        paidBy: me.id,
        split: { mode: 'exact', shares: { [me.id]: '70', [partner.id]: '20' } },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', fields: { split: expect.any(String) } })
    await expect(
      service.addEntry(me, id, {
        ...base,
        paidBy: me.id,
        split: { mode: 'equal', participants: [me.id, users.stranger.id] },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('hides ledgers from non-members and limits member management to the owner', async () => {
    const { service, id } = await couple()
    await expect(service.get(users.stranger, id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.addMember(partner, id, users.viewer.email)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(service.addMember(me, id, 'pending@test')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    })
    await expect(service.addMember(me, id, partner.email)).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    await expect(service.removeMember(me, id, me.id)).rejects.toMatchObject({
      code: 'OWNER_CANNOT_LEAVE',
    })
    await service.removeMember(partner, id, partner.id)
    expect(await service.list(partner)).toEqual([])
  })
})
