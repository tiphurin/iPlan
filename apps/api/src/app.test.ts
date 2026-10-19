import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import type { AuthGateway } from './infra/auth'
import type { MeRepository, UserRow } from './modules/me/me.repository'
import { ItemsService } from './modules/items/items.service'
import { MeService } from './modules/me/me.service'
import { TripsService } from './modules/trips/trips.service'
import { LedgersService } from './modules/ledgers/ledgers.service'
import { MembersService } from './modules/members/members.service'
import { AccessService } from './modules/access/access.service'
import { AdminService } from './modules/admin/admin.service'
import { AttachmentsService } from './modules/attachments/attachments.service'
import { BackupService } from './modules/backup/backup.service'
import { ChecklistService } from './modules/checklist/checklist.service'
import { FinanceService } from './modules/finance/finance.service'
import { ExpensesService } from './modules/expenses/expenses.service'
import { InfoCardsService } from './modules/info-cards/info-cards.service'
import {
  FakeAudit,
  GROUP_IDS,
  InMemoryAccess,
  InMemoryAdmin,
  InMemoryAttachments,
  InMemoryBackup,
  InMemoryChecklist,
  InMemoryExpenses,
  InMemoryFinance,
  InMemoryInfoCards,
  InMemoryItems,
  InMemoryLedgers,
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
  status: 'active',
  avatarKey: null,
}

/** Non-admin accounts used to test approval and feature gates. */
const others: Record<string, UserRow> = {
  traveler: { ...owner, id: 'traveler', email: 'traveler@test', role: 'user' },
  waiting: { ...owner, id: 'waiting', email: 'waiting@test', role: 'user', status: 'pending' },
  boss: { ...owner, id: 'boss', email: 'Boss@Example.com', role: 'user', status: 'pending' },
}

const users: MeRepository = {
  findById: async (id) => (id === owner.id ? owner : (others[id] ?? null)),
  update: async (id, changes) => (id === owner.id ? { ...owner, ...changes } : null),
}

/** `Cookie: session=<id>` signs in as that user; `session=u1` is the admin owner. */
const auth: AuthGateway = {
  handler: async () => new Response('auth', { status: 200 }),
  getSessionUser: async (headers) => {
    const id = headers.get('cookie')?.replace('session=', '')
    if (id === owner.id) return owner
    return id ? (others[id] ?? null) : null
  },
}

const audit = new FakeAudit()
const tripRepo = new InMemoryTrips()
const trips = new TripsService(tripRepo, audit)
const storage = new MemoryStorage()
const itemRepo = new InMemoryItems()
const checklistRepo = new InMemoryChecklist()
const infoRepo = new InMemoryInfoCards()
const expenseRepo = new InMemoryExpenses(tripRepo)
const accessRepo = new InMemoryAccess()
accessRepo.members.set('traveler', [GROUP_IDS.travelers])
const access = new AccessService(accessRepo, audit)
const deps = {
  auth,
  storage,
  adminEmails: ['boss@example.com'],
  services: {
    access,
    me: new MeService(users, access),
    trips,
    items: new ItemsService(itemRepo, trips, audit),
    members: new MembersService(new InMemoryMembers(tripRepo), trips, audit),
    checklist: new ChecklistService(checklistRepo, trips, audit),
    infoCards: new InfoCardsService(infoRepo, trips, audit),
    expenses: new ExpensesService(expenseRepo, trips, tripRepo, audit),
    attachments: new AttachmentsService(new InMemoryAttachments(), storage, trips, audit),
    finance: new FinanceService(new InMemoryFinance(), audit),
    ledgers: new LedgersService(new InMemoryLedgers(), audit),
    admin: new AdminService(new InMemoryAdmin(), accessRepo, audit),
    backup: new BackupService(
      {
        trips: tripRepo,
        items: itemRepo,
        checklist: checklistRepo,
        infoCards: infoRepo,
        expenses: expenseRepo,
      },
      new InMemoryBackup(tripRepo, itemRepo, checklistRepo, infoRepo),
      trips,
      audit,
    ),
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

  it('keeps pending accounts on the waiting list', async () => {
    const headers = { cookie: 'session=waiting' }
    const me = await app.request('/api/me', { headers })
    expect(me.status).toBe(200)
    expect(await me.json()).toMatchObject({ status: 'pending', features: [] })
    const trips = await app.request('/api/trips', { headers })
    expect(trips.status).toBe(403)
    expect(await trips.json()).toMatchObject({ error: { code: 'ACCOUNT_PENDING' } })
  })

  it('only opens the features granted to the user', async () => {
    const headers = { cookie: 'session=traveler' }
    expect(await (await app.request('/api/me', { headers })).json()).toMatchObject({
      status: 'active',
      features: ['trips'],
    })
    expect((await app.request('/api/trips', { headers })).status).toBe(200)
    const finance = await app.request('/api/finance/categories', { headers })
    expect(finance.status).toBe(403)
    expect(await finance.json()).toMatchObject({ error: { code: 'FEATURE_DISABLED' } })
    expect((await app.request('/api/admin/users', { headers })).status).toBe(403)
  })

  it('treats ADMIN_EMAILS as active admins, ignoring case', async () => {
    const headers = { cookie: 'session=boss' }
    expect(await (await app.request('/api/me', { headers })).json()).toMatchObject({
      role: 'admin',
      status: 'active',
      features: ['trips', 'finance', 'shared'],
    })
    expect((await app.request('/api/admin/groups', { headers })).status).toBe(200)
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

  it('round-trips a trip through backup, import and calendar', async () => {
    const headers = { ...signedIn, 'content-type': 'application/json' }
    const created = (await (
      await app.request('/api/trips', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Tokyo', startDate: '2026-11-01', endDate: '2026-11-03' }),
      })
    ).json()) as { id: string }
    await app.request(`/api/trips/${created.id}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dayDate: '2026-11-01',
        kind: 'place',
        title: 'Senso-ji, Asakusa',
        startsAt: '2026-11-01T01:00:00Z',
        timeZone: 'Asia/Tokyo',
      }),
    })
    const backup = await (
      await app.request(`/api/trips/${created.id}/backup.json`, { headers: signedIn })
    ).json()
    expect(backup).toMatchObject({ format: 'iplan.trip', version: 1, trip: { name: 'Tokyo' } })

    const imported = await app.request('/api/trips/import', {
      method: 'POST',
      headers,
      body: JSON.stringify(backup),
    })
    expect(imported.status).toBe(201)
    const { tripId } = (await imported.json()) as { tripId: string }
    expect(tripId).not.toBe(created.id)
    const items = (await (
      await app.request(`/api/trips/${tripId}/items`, { headers: signedIn })
    ).json()) as unknown[]
    expect(items).toHaveLength(1)

    const ics = await app.request(`/api/trips/${tripId}/calendar.ics`, { headers: signedIn })
    expect(ics.headers.get('content-type')).toContain('text/calendar')
    expect(await ics.text()).toContain('SUMMARY:Senso-ji\\, Asakusa')

    const bad = await app.request('/api/trips/import', {
      method: 'POST',
      headers,
      body: '{"hello":1}',
    })
    expect(bad.status).toBe(422)
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
