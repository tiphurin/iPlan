import { beforeEach, describe, expect, it } from 'vitest'
import { CreateTripItemInput, ShiftItemsInput } from '@iplan/contracts'
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

  it('saves a ride that changes lines, with its start and end stations', async () => {
    const ride = await service.create(users.owner, tripId, {
      ...lunch,
      kind: 'move',
      title: 'Purple to Blue',
      details: {
        line: 'MRT-PP',
        lineColor: '#6c2c8d',
        via: ['MRT-BL'],
        from: 'Khlong Bang Phai',
        to: 'Sam Yan',
      },
    })
    expect(ride.details).toMatchObject({
      line: 'MRT-PP',
      via: ['MRT-BL'],
      from: 'Khlong Bang Phai',
      to: 'Sam Yan',
    })
  })

  it('rejects malformed transfer lines', () => {
    const bad = CreateTripItemInput.safeParse({
      ...lunch,
      kind: 'move',
      details: { line: 'MRT-PP', via: ['', 'x'.repeat(21)] },
    })
    expect(bad.success).toBe(false)
    const tooMany = CreateTripItemInput.safeParse({
      ...lunch,
      kind: 'move',
      details: { line: 'MRT-PP', via: Array.from({ length: 7 }, (_, i) => `L${i}`) },
    })
    expect(tooMany.success).toBe(false)
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

  it('moves several items by the same minutes, all or nothing', async () => {
    const a = await service.create(users.owner, tripId, lunch)
    const b = await service.create(users.owner, tripId, {
      ...lunch,
      title: 'Coffee',
      startsAt: '2026-10-23T05:30:00.000Z',
      endsAt: null,
    })
    const after = await service.shift(users.editor, tripId, { itemIds: [a.id, b.id], minutes: 30 })
    const byId = Object.fromEntries(after.map((i) => [i.id, i]))
    expect(byId[a.id]).toMatchObject({
      startsAt: '2026-10-23T04:30:00.000Z',
      endsAt: '2026-10-23T05:30:00.000Z',
    })
    expect(byId[b.id]).toMatchObject({ startsAt: '2026-10-23T06:00:00.000Z', endsAt: null })
    // Earlier works too.
    const back = await service.shift(users.owner, tripId, { itemIds: [a.id], minutes: -30 })
    expect(back.find((i) => i.id === a.id)?.startsAt).toBe('2026-10-23T04:00:00.000Z')
  })

  it('refuses fixed items, other trips, viewers, and changes nothing then', async () => {
    const free = await service.create(users.owner, tripId, lunch)
    const flight = await service.create(users.owner, tripId, {
      ...lunch,
      title: 'Flight',
      startsAt: '2026-10-23T08:00:00.000Z',
      endsAt: '2026-10-23T10:00:00.000Z',
      details: { fixed: true },
    })
    await expect(
      service.shift(users.owner, tripId, { itemIds: [free.id, flight.id], minutes: 15 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    // All or nothing: the free item did not move either.
    expect((await items.findById(free.id))?.startsAt.toISOString()).toBe(lunch.startsAt)
    await expect(
      service.shift(users.viewer, tripId, { itemIds: [free.id], minutes: 15 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      service.shift(users.owner, tripId, {
        itemIds: ['00000000-0000-4000-8000-000000000999'],
        minutes: 15,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('keeps the plan day when moving and validates the request', async () => {
    const last = await service.create(users.owner, tripId, {
      ...lunch,
      dayDate: '2026-10-27',
      startsAt: '2026-10-27T04:00:00.000Z',
      endsAt: '2026-10-27T05:00:00.000Z',
    })
    // Moving keeps the plan day; only its clock time changes, which is always allowed.
    await expect(
      service.shift(users.owner, tripId, { itemIds: [last.id], minutes: 120 }),
    ).resolves.toBeDefined()
    expect(ShiftItemsInput.safeParse({ itemIds: [last.id], minutes: 0 }).success).toBe(false)
    expect(ShiftItemsInput.safeParse({ itemIds: [], minutes: 10 }).success).toBe(false)
    expect(ShiftItemsInput.safeParse({ itemIds: [last.id], minutes: 2000 }).success).toBe(false)
  })
})
