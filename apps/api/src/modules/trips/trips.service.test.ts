import { beforeEach, describe, expect, it } from 'vitest'
import {
  FakeAudit,
  InMemoryExpenses,
  InMemoryItems,
  InMemoryTrips,
  users,
} from '../../testing/fakes'
import { TripsService } from './trips.service'

const input = {
  name: 'Seoul',
  destination: 'Seoul, Korea',
  startDate: '2026-10-22',
  endDate: '2026-10-27',
  homeTimeZone: 'Asia/Bangkok',
  baseCurrency: 'THB',
}

describe('TripsService', () => {
  let repo: InMemoryTrips
  let audit: FakeAudit
  let service: TripsService
  let tripId: string

  beforeEach(async () => {
    repo = new InMemoryTrips()
    audit = new FakeAudit()
    service = new TripsService(repo, audit)
    tripId = (await service.create(users.owner, input)).id
    repo.addMember(tripId, 'editor', 'editor')
    repo.addMember(tripId, 'viewer', 'viewer')
  })

  it('makes the creator the owner and audits it', async () => {
    const trip = await service.get(users.owner, tripId)
    expect(trip).toMatchObject({ name: 'Seoul', role: 'owner', memberCount: 3 })
    expect(audit.entries[0]).toMatchObject({ action: 'trip.create', actorId: 'owner' })
  })

  it('lists only trips the user belongs to', async () => {
    expect(await service.list(users.viewer)).toHaveLength(1)
    expect(await service.list(users.stranger)).toHaveLength(0)
  })

  it('hides trips from non-members as NOT_FOUND', async () => {
    await expect(service.get(users.stranger, tripId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('lets editors edit but not viewers', async () => {
    await expect(
      service.update(users.editor, tripId, { name: 'Seoul 2026' }),
    ).resolves.toMatchObject({
      name: 'Seoul 2026',
    })
    await expect(service.update(users.viewer, tripId, { name: 'x' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('lets only the owner delete', async () => {
    await expect(service.remove(users.editor, tripId)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await service.remove(users.owner, tripId)
    expect(await service.list(users.owner)).toHaveLength(0)
  })

  it('validates dates and time zone', async () => {
    await expect(
      service.create(users.owner, { ...input, endDate: '2026-10-01' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', fields: { endDate: expect.any(String) } })
    await expect(
      service.create(users.owner, { ...input, endDate: '2027-01-30' }),
    ).rejects.toMatchObject({ fields: { endDate: expect.stringContaining('60 days') } })
    await expect(
      service.update(users.owner, tripId, { homeTimeZone: 'Mars/Base' }),
    ).rejects.toMatchObject({ fields: { homeTimeZone: 'Unknown time zone' } })
    // Partial update is checked against the stored dates.
    await expect(
      service.update(users.owner, tripId, { startDate: '2026-10-28' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  describe('with plans and expenses', () => {
    let items: InMemoryItems
    let expenses: InMemoryExpenses

    beforeEach(() => {
      items = new InMemoryItems()
      expenses = new InMemoryExpenses(repo, items)
      repo.linked = { items, expenses }
    })

    const addItem = (dayDate: string) =>
      items.create({
        tripId,
        dayDate,
        kind: 'place',
        title: 'Palace',
        startsAt: new Date(`${dayDate}T01:00:00Z`),
        endsAt: null,
        timeZone: 'Asia/Seoul',
        notes: null,
        details: {},
        sortOrder: 0,
      })

    const addExpense = (dayDate: string) =>
      expenses.create(
        {
          tripId,
          dayDate,
          itemId: null,
          title: 'Lunch',
          category: 'food',
          subcategory: null,
          amountMinor: 10000n,
          currency: 'THB',
          fxRate: '1',
          baseAmountMinor: 10000n,
          paidBy: 'owner',
          splitMode: 'equal',
          note: null,
          createdBy: 'owner',
        },
        [{ userId: 'owner', amountMinor: 10000n, percentBp: null }],
      )

    it('locks the trip currency once expenses exist', async () => {
      await addExpense('2026-10-23')
      await expect(
        service.update(users.owner, tripId, { baseCurrency: 'KRW' }),
      ).rejects.toMatchObject({ code: 'TRIP_CURRENCY_LOCKED', status: 409 })
      // Sending the same currency (the edit form always does) is fine.
      await expect(
        service.update(users.owner, tripId, { name: 'Seoul!', baseCurrency: 'THB' }),
      ).resolves.toMatchObject({ name: 'Seoul!', baseCurrency: 'THB' })
    })

    it('clears base-currency rates and budget when the currency changes on an empty trip', async () => {
      await repo.update(tripId, { fxRates: { KRW: '0.025' }, dailyBudgetMinor: 300000n })
      const trip = await service.update(users.owner, tripId, { baseCurrency: 'KRW' })
      expect(trip).toMatchObject({ baseCurrency: 'KRW', fxRates: {}, dailyBudgetMinor: null })
    })

    it('keeps the currency when an update leaves it out', async () => {
      await repo.update(tripId, { baseCurrency: 'KRW' })
      await service.update(users.owner, tripId, { name: 'Renamed' })
      expect((await service.get(users.owner, tripId)).baseCurrency).toBe('KRW')
    })

    it('refuses dates that would leave plans or expenses outside the trip', async () => {
      await addItem('2026-10-22')
      await addExpense('2026-10-27')
      await expect(
        service.update(users.owner, tripId, { startDate: '2026-10-23' }),
      ).rejects.toMatchObject({ code: 'TRIP_DATES_EXCLUDE_CONTENT', status: 409 })
      await expect(
        service.update(users.owner, tripId, { endDate: '2026-10-26' }),
      ).rejects.toMatchObject({ code: 'TRIP_DATES_EXCLUDE_CONTENT' })
      // Growing the trip is always fine.
      await expect(
        service.update(users.owner, tripId, { startDate: '2026-10-21', endDate: '2026-10-28' }),
      ).resolves.toMatchObject({ startDate: '2026-10-21', endDate: '2026-10-28' })
    })
  })
})
