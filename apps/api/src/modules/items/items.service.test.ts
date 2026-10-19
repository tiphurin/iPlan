import { beforeEach, describe, expect, it } from 'vitest'
import { FakeAudit, InMemoryItems, InMemoryTrips, users } from '../../testing/fakes'
import { TripsService } from '../trips/trips.service'
import { ItemsService } from './items.service'

const lunch = {
  dayDate: '2026-10-23',
  kind: 'place' as const,
  title: 'Lunch',
  startsAt: '2026-10-23T04:00:00.000Z',
  endsAt: '2026-10-23T05:00:00.000Z',
  timeZone: 'Asia/Seoul',
}

describe('ItemsService', () => {
  let items: InMemoryItems
  let service: ItemsService
  let tripId: string

  beforeEach(async () => {
    const trips = new InMemoryTrips()
    const audit = new FakeAudit()
    const tripService = new TripsService(trips, audit)
    tripId = (
      await tripService.create(users.owner, {
        name: 'Seoul',
        startDate: '2026-10-22',
        endDate: '2026-10-27',
        homeTimeZone: 'Asia/Bangkok',
        baseCurrency: 'THB',
      })
    ).id
    trips.addMember(tripId, 'editor', 'editor')
    trips.addMember(tripId, 'viewer', 'viewer')
    items = new InMemoryItems()
    service = new ItemsService(items, tripService, audit)
  })

  it('lets editors add items and orders them per day', async () => {
    const a = await service.create(users.editor, tripId, lunch)
    const b = await service.create(users.owner, tripId, { ...lunch, title: 'Coffee' })
    expect([a.sortOrder, b.sortOrder]).toEqual([0, 1])
    expect(a).toMatchObject({ title: 'Lunch', endsAt: '2026-10-23T05:00:00.000Z', checkIns: [] })
  })

  it('stops viewers and strangers from editing', async () => {
    await expect(service.create(users.viewer, tripId, lunch)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    const item = await service.create(users.owner, tripId, lunch)
    await expect(service.remove(users.viewer, item.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(service.list(users.stranger, tripId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.remove(users.stranger, item.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('validates day, times and zones', async () => {
    await expect(
      service.create(users.owner, tripId, { ...lunch, dayDate: '2026-11-01' }),
    ).rejects.toMatchObject({ fields: { dayDate: expect.any(String) } })
    await expect(
      service.create(users.owner, tripId, { ...lunch, endsAt: lunch.startsAt }),
    ).rejects.toMatchObject({ fields: { endsAt: 'End must be after start' } })
    await expect(
      service.create(users.owner, tripId, { ...lunch, timeZone: 'Nowhere/City' }),
    ).rejects.toMatchObject({ fields: { timeZone: 'Unknown time zone' } })
    const item = await service.create(users.owner, tripId, lunch)
    // Moving the start past the stored end is caught too.
    await expect(
      service.update(users.owner, item.id, { startsAt: '2026-10-23T06:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    await expect(
      service.update(users.owner, item.id, { startsAt: '2026-10-23T06:00:00.000Z', endsAt: null }),
    ).resolves.toMatchObject({ endsAt: null })
  })

  it('duplicates an item to the end of its day', async () => {
    const item = await service.create(users.owner, tripId, lunch)
    const copy = await service.duplicate(users.editor, item.id)
    expect(copy).toMatchObject({ title: 'Lunch', sortOrder: 1 })
    expect(copy.id).not.toBe(item.id)
  })

  it('lets any member check in, once per person', async () => {
    const item = await service.create(users.owner, tripId, lunch)
    const now = new Date('2026-10-23T04:07:00.000Z')
    await service.checkIn(users.viewer, item.id, {}, now)
    const again = await service.checkIn(
      users.viewer,
      item.id,
      { at: '2026-10-23T04:10:00.000Z' },
      now,
    )
    expect(again.checkIns).toEqual([
      {
        userId: 'viewer',
        name: 'Viewer',
        checkedInAt: '2026-10-23T04:10:00.000Z',
        skipped: false,
      },
    ])
    // Skipping replaces the check-in; undo clears either.
    const skipped = await service.checkIn(users.viewer, item.id, { skipped: true }, now)
    expect(skipped.checkIns[0]).toMatchObject({ skipped: true })
    expect((await service.undoCheckIn(users.viewer, item.id)).checkIns).toEqual([])
    await expect(
      service.checkIn(users.viewer, item.id, { at: '2027-06-01T00:00:00.000Z' }, now),
    ).rejects.toMatchObject({ fields: { at: expect.any(String) } })
  })

  it('keeps an arrival zone only on flights', async () => {
    const flight = await service.create(users.owner, tripId, {
      ...lunch,
      kind: 'flight',
      details: { arrivalTimeZone: 'Asia/Bangkok', flightNumber: 'TG659' },
    })
    expect(flight.details).toEqual({ arrivalTimeZone: 'Asia/Bangkok', flightNumber: 'TG659' })
    // Turning it into a place drops the arrival zone but keeps the rest.
    const place = await service.update(users.owner, flight.id, { kind: 'place' })
    expect(place.details).toEqual({ flightNumber: 'TG659' })
    const created = await service.create(users.owner, tripId, {
      ...lunch,
      details: { arrivalTimeZone: 'Asia/Tokyo' },
    })
    expect(created.details).toEqual({})
  })
})
