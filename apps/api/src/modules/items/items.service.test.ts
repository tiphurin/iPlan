import { beforeEach, describe, expect, it } from 'vitest'
import { CreateTripItemInput, RetimeItemsInput, ShiftItemsInput } from '@iplan/contracts'
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

  describe('retime', () => {
    const t = (hhmm: string) => `2026-10-23T${hhmm}:00.000Z`

    it('swaps two places in one go, marks the changed route, and undoes it', async () => {
      const palace = await service.create(users.owner, tripId, {
        ...lunch,
        title: 'Palace',
        startsAt: t('03:00'),
        endsAt: t('04:30'),
      })
      const train = await service.create(users.owner, tripId, {
        ...lunch,
        kind: 'move',
        title: 'Train',
        startsAt: t('04:35'),
        endsAt: t('04:45'),
        details: { line: '3', verify: false },
      })
      const market = await service.create(users.owner, tripId, {
        ...lunch,
        title: 'Market',
        startsAt: t('04:45'),
        endsAt: t('06:30'),
      })
      const swap = {
        changes: [
          {
            id: train.id,
            expectStartsAt: train.startsAt,
            startsAt: t('03:00'),
            endsAt: t('03:10'),
            verify: true,
          },
          {
            id: market.id,
            expectStartsAt: market.startsAt,
            startsAt: t('03:10'),
            endsAt: t('04:55'),
          },
          {
            id: palace.id,
            expectStartsAt: palace.startsAt,
            startsAt: t('04:55'),
            endsAt: t('06:25'),
          },
        ],
      }
      const after = await service.retime(users.editor, tripId, swap)
      const byId = Object.fromEntries(after.map((i) => [i.id, i]))
      expect(byId[market.id]).toMatchObject({ startsAt: t('03:10'), endsAt: t('04:55') })
      expect(byId[palace.id]).toMatchObject({ startsAt: t('04:55'), endsAt: t('06:25') })
      // Marked "to check", other details kept.
      expect(byId[train.id]?.details).toEqual({ line: '3', verify: true })
      expect(byId[palace.id]?.details).toEqual({})

      // Undo: the same call with the old times and the old flag.
      const undone = await service.retime(users.owner, tripId, {
        changes: [
          {
            id: train.id,
            expectStartsAt: t('03:00'),
            startsAt: train.startsAt,
            endsAt: train.endsAt,
            verify: false,
          },
          {
            id: market.id,
            expectStartsAt: t('03:10'),
            startsAt: market.startsAt,
            endsAt: market.endsAt,
          },
          {
            id: palace.id,
            expectStartsAt: t('04:55'),
            startsAt: palace.startsAt,
            endsAt: palace.endsAt,
          },
        ],
      })
      const back = Object.fromEntries(undone.map((i) => [i.id, i]))
      expect(back[palace.id]).toMatchObject({ startsAt: palace.startsAt, endsAt: palace.endsAt })
      expect(back[train.id]?.details).toEqual({ line: '3' })
    })

    it('refuses a plan changed meanwhile, fixed items, viewers and repeats, changing nothing', async () => {
      const a = await service.create(users.owner, tripId, lunch)
      const fixed = await service.create(users.owner, tripId, {
        ...lunch,
        title: 'Booked',
        startsAt: t('08:00'),
        endsAt: t('09:00'),
        details: { fixed: true },
      })
      const move = (expect = a.startsAt) => ({
        id: a.id,
        expectStartsAt: expect,
        startsAt: t('05:00'),
        endsAt: t('06:00'),
      })
      // Someone else moved it after the client loaded the plan.
      await expect(
        service.retime(users.owner, tripId, { changes: [move(t('03:00'))] }),
      ).rejects.toMatchObject({ code: 'PLAN_CHANGED', status: 409 })
      await expect(
        service.retime(users.owner, tripId, {
          changes: [
            move(),
            {
              id: fixed.id,
              expectStartsAt: fixed.startsAt,
              startsAt: t('09:00'),
              endsAt: t('10:00'),
            },
          ],
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
      // All or nothing: the free item did not move either.
      expect((await items.findById(a.id))?.startsAt.toISOString()).toBe(lunch.startsAt)
      // Checked in: it happened at that time, so it can't move until the check-in is undone.
      await service.checkIn(users.owner, a.id, {})
      await expect(
        service.retime(users.owner, tripId, { changes: [move()] }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
      await service.undoCheckIn(users.owner, a.id)
      // A fixed item may be sent unchanged (e.g. only to flag its route).
      await expect(
        service.retime(users.owner, tripId, {
          changes: [
            {
              id: fixed.id,
              expectStartsAt: fixed.startsAt,
              startsAt: fixed.startsAt,
              endsAt: fixed.endsAt,
              verify: true,
            },
          ],
        }),
      ).resolves.toBeDefined()
      await expect(
        service.retime(users.viewer, tripId, { changes: [move()] }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(
        service.retime(users.owner, tripId, { changes: [move(), move()] }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
      await expect(
        service.retime(users.owner, tripId, {
          changes: [{ ...move(), endsAt: t('04:00') }],
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
      expect(RetimeItemsInput.safeParse({ changes: [] }).success).toBe(false)
    })
  })
})
