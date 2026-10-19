import { describe, expect, it } from 'vitest'
import {
  FakeAudit,
  InMemoryAccess,
  InMemoryInvitations,
  InMemoryLedgers,
  InMemoryPeople,
  users,
} from '../../testing/fakes'
import { AccessService } from '../access/access.service'
import { InvitationsService } from '../invitations/invitations.service'
import { LedgersService } from './ledgers.service'

const me = users.owner
const partner = users.editor

async function setup() {
  const repo = new InMemoryLedgers()
  const audit = new FakeAudit()
  const accessRepo = new InMemoryAccess()
  const invitesRepo = new InMemoryInvitations(undefined, repo)
  const invitations = new InvitationsService(
    invitesRepo,
    new InMemoryPeople(accessRepo),
    new AccessService(accessRepo, audit),
    audit,
  )
  // Inviting needs a shared circle.
  const family = await accessRepo.createCircle('Family')
  await accessRepo.setUserCircles(me.id, [family])
  await accessRepo.setUserCircles(partner.id, [family])
  return { repo, invitations, service: new LedgersService(repo, audit, invitations) }
}

async function couple() {
  const ctx = await setup()
  const ledger = await ctx.service.create(me, { name: 'Home', currency: 'THB' })
  const [invite] = await ctx.service.invite(me, ledger.id, partner.id)
  if (!invite) throw new Error('no invite')
  // Shared money needs the feature; "Full access" in the fake grants trips + finance only.
  ;(ctx.invitations as unknown as { access: { requireFeature: () => Promise<void> } }).access = {
    requireFeature: async () => undefined,
  }
  await ctx.invitations.accept(partner, invite.id)
  return { ...ctx, id: ledger.id }
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
      {
        month: '2026-10',
        totalMinor: '200000',
        myShareMinor: '150000',
        byCategory: [{ category: 'food', totalMinor: '200000' }],
        owed: [{ from: partner.id, to: me.id, amountMinor: '50000' }],
        transfers: [{ from: partner.id, to: me.id, amountMinor: '50000' }],
        needMinor: '50000',
        paidMinor: '0',
        status: 'unpaid',
      },
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

  it('only adds people after they accept, and only the owner invites', async () => {
    const { service, invitations } = await setup()
    const ledger = await service.create(me, { name: 'Flat', currency: 'THB' })
    const pending = await service.invite(me, ledger.id, partner.id)
    expect(pending.map((p) => p.userId)).toEqual([partner.id])
    expect((await service.get(me, ledger.id)).members.map((m) => m.userId)).toEqual([me.id])
    await expect(service.invite(me, ledger.id, partner.id)).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    await expect(service.invite(me, ledger.id, users.stranger.id)).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    })
    // Declining removes the invitation.
    const [invite] = await invitations.mine(partner)
    await invitations.remove(partner, invite?.id ?? '')
    expect((await service.get(me, ledger.id)).pendingInvites).toEqual([])
  })

  it('hides ledgers from non-members; admins read, the superadmin can edit', async () => {
    const { service, id } = await couple()
    await expect(service.get(users.stranger, id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.invite(partner, id, users.viewer.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(service.removeMember(me, id, me.id)).rejects.toMatchObject({
      code: 'OWNER_CANNOT_LEAVE',
    })
    const admin = { ...users.viewer, role: 'admin' as const }
    expect((await service.get(admin, id)).readOnly).toBe(true)
    const entry = {
      title: 'X',
      category: 'other' as const,
      amount: '10',
      date: '2026-10-19',
      paidBy: me.id,
      split: { mode: 'equal' as const, participants: [me.id] },
    }
    await expect(service.addEntry(admin, id, entry)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const superadmin = { ...users.viewer, role: 'superadmin' as const }
    expect((await service.get(superadmin, id)).readOnly).toBe(false)
    await expect(service.addEntry(superadmin, id, entry)).resolves.toMatchObject({ title: 'X' })
    await service.removeMember(partner, id, partner.id)
    expect(await service.list(partner)).toEqual([])
  })

  it('settles a month: partly, fully, and back to unpaid', async () => {
    const { service, id } = await couple()
    const add = (title: string, date: string, amount: string) =>
      service.addEntry(me, id, {
        title,
        category: 'home',
        amount,
        date,
        paidBy: me.id,
        split: { mode: 'equal', participants: [me.id, partner.id] },
      })
    await add('Rent', '2026-10-01', '10000')
    await add('Water', '2026-09-03', '400')
    const month = (d: Awaited<ReturnType<typeof service.get>>, m: string) =>
      d.months.find((x) => x.month === m)

    let detail = await service.setMonthStatus(me, id, '2026-10', {
      status: 'partial',
      amount: '2000',
    })
    expect(month(detail, '2026-10')).toMatchObject({ status: 'partial', paidMinor: '200000' })
    expect(detail.myBalanceMinor).toBe(String(500000 - 200000 + 20000))

    detail = await service.setMonthStatus(me, id, '2026-10', { status: 'paid' })
    expect(month(detail, '2026-10')).toMatchObject({ status: 'paid', paidMinor: '500000' })
    // September is untouched.
    expect(month(detail, '2026-09')).toMatchObject({ status: 'unpaid', needMinor: '20000' })

    detail = await service.setMonthStatus(me, id, '2026-10', { status: 'unpaid' })
    expect(month(detail, '2026-10')).toMatchObject({ status: 'unpaid', paidMinor: '0' })
    // Paying more than owed flips the balance the other way, and the card says so.
    detail = await service.setMonthStatus(me, id, '2026-10', { status: 'partial', amount: '5500' })
    expect(month(detail, '2026-10')).toMatchObject({
      status: 'partial',
      paidMinor: '550000',
      needMinor: '500000',
      transfers: [{ from: me.id, to: partner.id, amountMinor: '50000' }],
    })
    expect(detail.myBalanceMinor).toBe(String(-50000 + 20000))
    // Correcting it to "paid" records exactly what was needed.
    detail = await service.setMonthStatus(me, id, '2026-10', { status: 'paid' })
    expect(month(detail, '2026-10')).toMatchObject({ status: 'paid', transfers: [] })
    await expect(
      service.setMonthStatus(me, id, '2026-10', { status: 'partial', amount: '0' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('marks single expenses as paid back, and deleting the expense removes the payback', async () => {
    const { service, id } = await couple()
    const entry = await service.addEntry(me, id, {
      title: 'Dinner',
      category: 'food',
      amount: '2000',
      date: '2026-10-19',
      paidBy: me.id,
      split: { mode: 'exact', shares: { [me.id]: '1500', [partner.id]: '500' } },
    })
    const paid = await service.setEntryPaid(partner, entry.id, true)
    expect(paid.paidBack).toBe(true)
    let detail = await service.get(me, id)
    expect(detail.myBalanceMinor).toBe('0')
    expect(detail.months[0]).toMatchObject({ status: 'paid', paidMinor: '50000' })
    expect((await service.setEntryPaid(me, entry.id, false)).paidBack).toBe(false)
    await service.setEntryPaid(me, entry.id, true)
    await service.deleteEntry(me, entry.id)
    detail = await service.get(me, id)
    expect(detail.entries).toEqual([])
    expect(detail.myBalanceMinor).toBe('0')
  })

  it('pays in the wrong direction: the month stays open', async () => {
    const { service, id } = await couple()
    await service.addEntry(me, id, {
      title: 'Rent',
      category: 'home',
      amount: '1000',
      date: '2026-10-01',
      paidBy: me.id,
      split: { mode: 'equal', participants: [me.id, partner.id] },
    })
    // I pay my partner (who already owes me): that makes it worse, not settled.
    await service.settleUp(me, id, {
      from: me.id,
      to: partner.id,
      amount: '500',
      date: '2026-10-05',
    })
    const [oct] = (await service.get(me, id)).months
    expect(oct).toMatchObject({
      status: 'partial',
      transfers: [{ from: partner.id, to: me.id, amountMinor: '100000' }],
    })
  })

  it('counts plain settle-ups by date and lists settlement-only months', async () => {
    const { service, id } = await couple()
    await service.addEntry(me, id, {
      title: 'Rent',
      category: 'home',
      amount: '1000',
      date: '2026-10-01',
      paidBy: me.id,
      split: { mode: 'equal', participants: [me.id, partner.id] },
    })
    await service.settleUp(partner, id, {
      from: partner.id,
      to: me.id,
      amount: '500',
      date: '2026-10-20',
    })
    // A payment in a month with no spending (e.g. paying back early).
    await service.settleUp(partner, id, {
      from: partner.id,
      to: me.id,
      amount: '100',
      date: '2026-11-02',
    })
    let detail = await service.get(me, id)
    expect(detail.months.map((m) => [m.month, m.status])).toEqual([
      ['2026-11', 'partial'],
      ['2026-10', 'paid'],
    ])
    expect(detail.months[0]?.transfers).toEqual([
      { from: me.id, to: partner.id, amountMinor: '10000' },
    ])
    // Undo: "unpaid" removes that month's payments.
    detail = await service.setMonthStatus(me, id, '2026-11', { status: 'unpaid' })
    expect(detail.months.map((m) => m.month)).toEqual(['2026-10'])
    expect(detail.myBalanceMinor).toBe('0')
  })

  it('editing an expense drops its old payback', async () => {
    const { service, id } = await couple()
    const input = {
      title: 'Dinner',
      category: 'food' as const,
      amount: '1000',
      date: '2026-10-19',
      paidBy: me.id,
      split: { mode: 'equal' as const, participants: [me.id, partner.id] },
    }
    const entry = await service.addEntry(me, id, input)
    await service.setEntryPaid(partner, entry.id, true)
    const updated = await service.updateEntry(me, entry.id, { ...input, amount: '3000' })
    expect(updated.paidBack).toBe(false)
    const detail = await service.get(me, id)
    expect(detail.entries.filter((e) => e.kind === 'settlement')).toEqual([])
    expect(detail.myBalanceMinor).toBe('150000')
  })

  it('un-marking one expense keeps the month payment; marking one replaces it', async () => {
    const { service, id } = await couple()
    const add = (title: string, amount: string) =>
      service.addEntry(me, id, {
        title,
        category: 'home',
        amount,
        date: '2026-10-05',
        paidBy: me.id,
        split: { mode: 'equal', participants: [me.id, partner.id] },
      })
    const a = await add('Water', '200')
    const b = await add('Power', '600')
    await service.setEntryPaid(me, a.id, true)
    await service.setEntryPaid(me, a.id, false)
    await service.setMonthStatus(me, id, '2026-10', { status: 'paid' })
    // Un-marking an expense that has no payback leaves the month payment alone.
    await service.setEntryPaid(me, b.id, false)
    let detail = await service.get(me, id)
    expect(detail.months[0]).toMatchObject({ status: 'paid', paidMinor: '40000' })
    // Marking one replaces the month payment with that expense's payback.
    await service.setEntryPaid(me, b.id, true)
    detail = await service.get(me, id)
    expect(detail.months[0]).toMatchObject({ status: 'partial', paidMinor: '30000' })
    expect(detail.entries.some((e) => e.settlesMonth === '2026-10')).toBe(false)
  })

  it('runs concurrent month updates one at a time', async () => {
    const { service, id } = await couple()
    await service.addEntry(me, id, {
      title: 'Rent',
      category: 'home',
      amount: '1000',
      date: '2026-10-01',
      paidBy: me.id,
      split: { mode: 'equal', participants: [me.id, partner.id] },
    })
    await Promise.all([
      service.setMonthStatus(me, id, '2026-10', { status: 'paid' }),
      service.setMonthStatus(partner, id, '2026-10', { status: 'paid' }),
    ])
    const detail = await service.get(me, id)
    expect(detail.entries.filter((e) => e.kind === 'settlement')).toHaveLength(1)
    expect(detail.myBalanceMinor).toBe('0')
  })

  it('does not let a member with an open balance leave or be removed', async () => {
    const { service, id } = await couple()
    await service.addEntry(me, id, {
      title: 'Rent',
      category: 'home',
      amount: '1000',
      date: '2026-10-01',
      paidBy: me.id,
      split: { mode: 'equal', participants: [me.id, partner.id] },
    })
    await expect(service.removeMember(partner, id, partner.id)).rejects.toMatchObject({
      code: 'BALANCE_NOT_SETTLED',
      status: 409,
    })
    await expect(service.removeMember(me, id, partner.id)).rejects.toMatchObject({
      code: 'BALANCE_NOT_SETTLED',
    })
    await service.setMonthStatus(me, id, '2026-10', { status: 'paid' })
    await service.removeMember(partner, id, partner.id)
    expect(await service.list(partner)).toEqual([])
  })
})
