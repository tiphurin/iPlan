import { beforeEach, describe, expect, it } from 'vitest'
import { FakeAudit, InMemoryTrips, users } from '../../testing/fakes'
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
})
