import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import type { AuthGateway } from './infra/auth'
import type { MeRepository, UserRow } from './modules/me/me.repository'
import { ItemsService } from './modules/items/items.service'
import { MeService } from './modules/me/me.service'
import { TripsService } from './modules/trips/trips.service'
import { MembersService } from './modules/members/members.service'
import { AdminService } from './modules/admin/admin.service'
import { AttachmentsService } from './modules/attachments/attachments.service'
import { ChecklistService } from './modules/checklist/checklist.service'
import { FinanceService } from './modules/finance/finance.service'
import { ExpensesService } from './modules/expenses/expenses.service'
import { InfoCardsService } from './modules/info-cards/info-cards.service'
import {
  FakeAudit,
  InMemoryAdmin,
  InMemoryAttachments,
  InMemoryChecklist,
  InMemoryExpenses,
  InMemoryFinance,
  InMemoryInfoCards,
  InMemoryItems,
  InMemoryMembers,
  InMemoryTrips,
  MemoryStorage,
} from './testing/fakes'

const owner: UserRow = {
  id: 'u1',
  name: 'Demo Owner',
  email: 'dev@iplan.local',
  emailVerified: true,
  image: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  role: 'admin',
  banned: false,
  banReason: null,
  banExpires: null,
  locale: 'th',
}

const users: MeRepository = {
  findById: async (id) => (id === owner.id ? owner : null),
  update: async (id, changes) => (id === owner.id ? { ...owner, ...changes } : null),
}

/** Treats any request with `Cookie: session=u1` as signed in. */
const auth: AuthGateway = {
  handler: async () => new Response('auth', { status: 200 }),
  getSessionUser: async (headers) =>
    headers.get('cookie') === 'session=u1' ? { ...owner, role: 'admin' } : null,
}

const audit = new FakeAudit()
const tripRepo = new InMemoryTrips()
const trips = new TripsService(tripRepo, audit)
const storage = new MemoryStorage()
const deps = {
  auth,
  storage,
  services: {
    me: new MeService(users),
    trips,
    items: new ItemsService(new InMemoryItems(), trips, audit),
    members: new MembersService(new InMemoryMembers(tripRepo), trips, audit),
    checklist: new ChecklistService(new InMemoryChecklist(), trips, audit),
    infoCards: new InfoCardsService(new InMemoryInfoCards(), trips, audit),
    expenses: new ExpensesService(new InMemoryExpenses(tripRepo), trips, tripRepo, audit),
    attachments: new AttachmentsService(new InMemoryAttachments(), storage, trips, audit),
    finance: new FinanceService(new InMemoryFinance(), audit),
    admin: new AdminService(new InMemoryAdmin(), audit),
  },
}
const app = createApp(deps)
const signedIn = { cookie: 'session=u1' }

describe('API app', () => {
  it('answers health checks', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('delegates /api/auth/* to Better Auth', async () => {
    const res = await app.request('/api/auth/get-session')
    expect(await res.text()).toBe('auth')
  })

  it('returns 401 with an error code when signed out', async () => {
    const res = await app.request('/api/me')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Sign in required' },
    })
  })

  it('returns the signed-in user', async () => {
    const res = await app.request('/api/me', { headers: signedIn })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'u1', role: 'admin', locale: 'th' })
  })

  it('reports invalid input field by field', async () => {
    const res = await app.request('/api/me', {
      method: 'PATCH',
      headers: { ...signedIn, 'content-type': 'application/json' },
      body: JSON.stringify({ locale: 'fr' }),
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: { code: string; fields: Record<string, string> } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
    expect(Object.keys(body.error.fields)).toEqual(['locale'])
  })

  it('treats a suspended account as signed out', async () => {
    const banned = createApp({
      auth: { ...auth, getSessionUser: async () => ({ ...owner, banned: true }) },
      storage,
      services: deps.services,
    })
    expect((await banned.request('/api/me', { headers: signedIn })).status).toBe(401)
  })

  it('hides dev login unless enabled', async () => {
    const res = await app.request('/api/dev/login', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('creates a trip and adds an item over HTTP', async () => {
    const headers = { ...signedIn, 'content-type': 'application/json' }
    const created = await app.request('/api/trips', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Seoul', startDate: '2026-10-22', endDate: '2026-10-27' }),
    })
    expect(created.status).toBe(201)
    const trip = (await created.json()) as { id: string; role: string; homeTimeZone: string }
    expect(trip).toMatchObject({ role: 'owner', homeTimeZone: 'Asia/Bangkok' })

    const item = await app.request(`/api/trips/${trip.id}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dayDate: '2026-10-23',
        kind: 'flight',
        title: 'BKK → ICN',
        startsAt: '2026-10-22T19:25:00Z',
        endsAt: '2026-10-23T01:00:00Z',
        timeZone: 'Asia/Bangkok',
        details: { flightNumber: 'DM 101', arrivalTimeZone: 'Asia/Seoul' },
      }),
    })
    expect(item.status).toBe(201)
    const list = await app.request(`/api/trips/${trip.id}/items`, { headers: signedIn })
    expect(await list.json()).toHaveLength(1)
  })

  it('rejects malformed ids before reaching the service', async () => {
    const res = await app.request('/api/trips/not-a-uuid', { headers: signedIn })
    expect(res.status).toBe(422)
  })

  it('serves the OpenAPI document', async () => {
    const res = await app.request('/api/openapi.json')
    const doc = (await res.json()) as { paths: Record<string, unknown> }
    expect(Object.keys(doc.paths)).toContain('/api/me')
  })
})
