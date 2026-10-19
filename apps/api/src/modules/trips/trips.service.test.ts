import { CreateTripInput, UpdateTripInput } from '@iplan/contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  FakeAudit,
  InMemoryExpenses,
  InMemoryItems,
  InMemoryTrips,
  MemoryStorage,
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

  it('stores a cover colour on create, keeps it when left out and clears it with null', async () => {
    expect((await service.get(users.owner, tripId)).color).toBeNull()
    const created = await service.create(users.owner, { ...input, color: '#0e7490' })
    expect(created.color).toBe('#0e7490')

    await service.update(users.editor, tripId, { color: '#d6453d' })
    expect((await service.get(users.owner, tripId)).color).toBe('#d6453d')
    await service.update(users.editor, tripId, { name: 'Seoul 2026' })
    expect((await service.get(users.owner, tripId)).color).toBe('#d6453d')
    await service.update(users.editor, tripId, { color: null })
    expect((await service.get(users.owner, tripId)).color).toBeNull()
  })

  it('accepts any #rrggbb colour and never defaults one on update', () => {
    expect(CreateTripInput.parse({ ...input, color: '#FF00AA' }).color).toBe('#ff00aa')
    expect(CreateTripInput.safeParse({ ...input, color: 'red' }).success).toBe(false)
    expect(CreateTripInput.safeParse({ ...input, color: '#12345' }).success).toBe(false)
    expect(UpdateTripInput.safeParse({ color: 'url(javascript:x)' }).success).toBe(false)
    expect(UpdateTripInput.parse({ color: null })).toEqual({ color: null })
    expect(UpdateTripInput.parse({ name: 'x' })).not.toHaveProperty('color')
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

describe('TripsService cover photo', () => {
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2])
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  let repo: InMemoryTrips
  let storage: MemoryStorage
  let service: TripsService
  let tripId: string

  beforeEach(async () => {
    repo = new InMemoryTrips()
    storage = new MemoryStorage()
    service = new TripsService(repo, new FakeAudit(), storage)
    tripId = (await service.create(users.owner, input)).id
    repo.addMember(tripId, 'editor', 'editor')
    repo.addMember(tripId, 'viewer', 'viewer')
  })

  it('stores an uploaded cover and exposes only a versioned API url', async () => {
    const trip = await service.setCover(users.editor, tripId, webp)
    expect(trip.coverUrl).toMatch(new RegExp(`^/api/trips/${tripId}/cover\\?v=[0-9a-f-]+$`))
    expect(JSON.stringify(trip)).not.toContain('/cover-')
    const key = repo.trips.get(tripId)?.coverKey
    expect(key).toMatch(new RegExp(`^trips/${tripId}/cover-[0-9a-f-]+\\.webp$`))
    expect(storage.files.has(key ?? '')).toBe(true)
    await expect(service.coverFile(users.viewer, tripId)).resolves.toEqual({
      key,
      contentType: 'image/webp',
    })
  })

  it('replaces the previous file on a new upload', async () => {
    await service.setCover(users.owner, tripId, webp)
    const first = repo.trips.get(tripId)?.coverKey ?? ''
    const trip = await service.setCover(users.owner, tripId, png)
    const second = repo.trips.get(tripId)?.coverKey ?? ''
    expect(second).toMatch(/\.png$/)
    expect(storage.files.has(first)).toBe(false)
    expect([...storage.files.keys()]).toEqual([second])
    expect(trip.coverUrl).not.toBeNull()
  })

  it('rejects files that are not images by their bytes', async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
    await expect(service.setCover(users.owner, tripId, pdf)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 422,
    })
    expect(storage.files.size).toBe(0)
  })

  it('rejects covers over 5 MB', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1)
    big.set(webp)
    await expect(service.setCover(users.owner, tripId, big)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
  })

  it('lets only editors and owners change it, and hides it from strangers', async () => {
    await expect(service.setCover(users.viewer, tripId, webp)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(service.removeCover(users.viewer, tripId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(service.setCover(users.stranger, tripId, webp)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await service.setCover(users.owner, tripId, webp)
    await expect(service.coverFile(users.stranger, tripId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('removes the cover and its file', async () => {
    await service.setCover(users.owner, tripId, webp)
    const trip = await service.removeCover(users.editor, tripId)
    expect(trip.coverUrl).toBeNull()
    expect(storage.files.size).toBe(0)
    await expect(service.coverFile(users.owner, tripId)).resolves.toBeNull()
  })

  it('deletes the cover file with the trip', async () => {
    await service.setCover(users.owner, tripId, webp)
    await service.remove(users.owner, tripId)
    expect(storage.files.size).toBe(0)
  })
})
