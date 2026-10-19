import { describe, expect, it } from 'vitest'
import {
  FakeAudit,
  InMemoryBackup,
  InMemoryChecklist,
  InMemoryExpenses,
  InMemoryInfoCards,
  InMemoryItems,
  InMemoryTrips,
  users,
} from '../../testing/fakes'
import { TripsService } from '../trips/trips.service'
import { BackupService } from './backup.service'

function setup() {
  const audit = new FakeAudit()
  const tripRepo = new InMemoryTrips()
  const items = new InMemoryItems()
  const checklist = new InMemoryChecklist()
  const infoCards = new InMemoryInfoCards()
  const trips = new TripsService(tripRepo, audit)
  const service = new BackupService(
    { trips: tripRepo, items, checklist, infoCards, expenses: new InMemoryExpenses(tripRepo) },
    new InMemoryBackup(tripRepo, items, checklist, infoCards),
    trips,
    audit,
  )
  return { service, tripRepo, items }
}

const file = {
  format: 'iplan.trip',
  version: 1,
  trip: {
    name: 'Seoul',
    startDate: '2026-10-22',
    endDate: '2026-10-27',
    homeTimeZone: 'Asia/Bangkok',
    baseCurrency: 'THB',
    fxRates: { KRW: '0.0255', THB: '1' },
  },
  items: [
    {
      dayDate: '2026-10-23',
      kind: 'place',
      title: 'Palace',
      startsAt: '2026-10-23T01:00:00Z',
      endsAt: '2026-10-23T03:00:00Z',
      timeZone: 'Asia/Seoul',
    },
  ],
}

describe('BackupService.import', () => {
  it('imports a valid file and drops the 1:1 base rate', async () => {
    const { service, tripRepo, items } = setup()
    const { tripId } = await service.import(users.owner, file)
    expect(tripRepo.trips.get(tripId)?.fxRates).toEqual({ KRW: '0.0255' })
    expect(await items.listByTrip(tripId)).toHaveLength(1)
  })

  it('round-trips the cover colour and imports older files without one', async () => {
    const { service, tripRepo } = setup()
    const { tripId } = await service.import(users.owner, {
      ...file,
      trip: { ...file.trip, color: '#6366f1' },
    })
    expect(tripRepo.trips.get(tripId)?.color).toBe('#6366f1')
    const exported = await service.export(users.owner, tripId)
    expect(exported.trip.color).toBe('#6366f1')
    const { tripId: copyId } = await service.import(users.owner, exported)
    expect(tripRepo.trips.get(copyId)?.color).toBe('#6366f1')

    const { tripId: oldId } = await service.import(users.owner, file)
    expect(tripRepo.trips.get(oldId)?.color).toBeNull()
    const { tripId: oddId } = await service.import(users.owner, {
      ...file,
      trip: { ...file.trip, color: '#abcdef' },
    })
    expect(tripRepo.trips.get(oddId)?.color).toBeNull()
  })

  it.each([
    ['a zero rate', { trip: { ...file.trip, fxRates: { KRW: '0' } } }],
    ['a non-numeric rate', { trip: { ...file.trip, fxRates: { KRW: 'abc' } } }],
    ['an oversized rate', { trip: { ...file.trip, fxRates: { KRW: '1234567890' } } }],
    ['a huge daily budget', { trip: { ...file.trip, dailyBudget: '99999999999999999' } }],
    ['a trip over 60 days', { trip: { ...file.trip, endDate: '2027-02-01' } }],
    ['dates in the wrong order', { trip: { ...file.trip, endDate: '2026-10-01' } }],
    [
      'an item ending before it starts',
      { items: [{ ...file.items[0], endsAt: '2026-10-23T00:00:00Z' }] },
    ],
    ['an item outside the trip', { items: [{ ...file.items[0], dayDate: '2026-11-01' }] }],
  ])('rejects %s with VALIDATION_FAILED (422)', async (_label, change) => {
    const { service, tripRepo } = setup()
    await expect(service.import(users.owner, { ...file, ...change })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 422,
      fields: { file: expect.any(String) },
    })
    expect(tripRepo.trips.size).toBe(0)
  })
})
