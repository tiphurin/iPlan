import type { FeatureKey } from '@iplan/contracts'
import { describe, expect, it } from 'vitest'
import { FakeAudit, InMemoryTrips, users } from '../../testing/fakes'
import { TripsService } from '../trips/trips.service'
import type { CalendarFeedsRepository, FeedOwner } from './calendar.repository'
import { CalendarService } from './calendar.service'

class MemoryFeeds implements CalendarFeedsRepository {
  rows = new Map<string, { userId: string; tripId: string }>()
  status = new Map<string, string>()
  async find(token: string): Promise<FeedOwner | null> {
    const row = this.rows.get(token)
    if (!row) return null
    return { ...row, status: this.status.get(row.userId) ?? 'active', banned: false, role: 'user' }
  }
  async tokenFor(userId: string, tripId: string) {
    return [...this.rows].find(([, r]) => r.userId === userId && r.tripId === tripId)?.[0] ?? null
  }
  async save(userId: string, tripId: string, token: string) {
    for (const [k, r] of this.rows)
      if (r.userId === userId && r.tripId === tripId) this.rows.delete(k)
    this.rows.set(token, { userId, tripId })
  }
}

async function setup() {
  const repo = new InMemoryTrips()
  const trips = new TripsService(repo, new FakeAudit())
  const trip = await trips.create(users.owner, {
    name: 'Seoul',
    startDate: '2026-10-22',
    endDate: '2026-10-27',
    homeTimeZone: 'Asia/Bangkok',
    baseCurrency: 'THB',
  })
  const feeds = new MemoryFeeds()
  let n = 0
  const backup = { calendar: async () => ({ name: 'Seoul', ics: 'BEGIN:VCALENDAR' }) }
  const features = new Map<string, FeatureKey[]>([['owner', ['trips']]])
  const access = { featuresFor: async (a: { id: string }) => features.get(a.id) ?? [] }
  const service = new CalendarService(feeds, trips, backup, access, 'https://iplan.test', () => {
    n += 1
    return `token-number-${String(n).padStart(8, '0')}`
  })
  return { feeds, features, service, tripId: trip.id }
}

describe('CalendarService', () => {
  it('gives each member one stable link for iPhone and Google', async () => {
    const { service, tripId } = await setup()
    const first = await service.link(users.owner, tripId)
    expect(first.url).toBe('https://iplan.test/api/calendar/token-number-00000001.ics')
    expect(first.webcalUrl).toBe('webcal://iplan.test/api/calendar/token-number-00000001.ics')
    expect(first.googleUrl).toContain(encodeURIComponent(first.webcalUrl))
    expect((await service.link(users.owner, tripId)).url).toBe(first.url)
    await expect(service.link(users.stranger, tripId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('serves the feed by token, and rotating cuts off the old link', async () => {
    const { feeds, service, tripId } = await setup()
    await service.link(users.owner, tripId)
    await expect(service.ics('token-number-00000001')).resolves.toMatchObject({ name: 'Seoul' })
    await service.rotate(users.owner, tripId)
    await expect(service.ics('token-number-00000001')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.ics('token-number-00000002')).resolves.toBeTruthy()
    feeds.status.set(users.owner.id, 'pending')
    await expect(service.ics('token-number-00000002')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('stops serving once the trips feature is taken away', async () => {
    const { features, service, tripId } = await setup()
    await service.link(users.owner, tripId)
    await expect(service.ics('token-number-00000001')).resolves.toBeTruthy()
    features.set('owner', ['finance'])
    await expect(service.ics('token-number-00000001')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
