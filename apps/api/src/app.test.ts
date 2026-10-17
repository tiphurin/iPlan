import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import type { AuthGateway } from './infra/auth'
import type { MeRepository, UserRow } from './modules/me/me.repository'
import { MeService } from './modules/me/me.service'

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

const app = createApp({ auth, services: { me: new MeService(users) } })
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

  it('hides dev login unless enabled', async () => {
    const res = await app.request('/api/dev/login', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('serves the OpenAPI document', async () => {
    const res = await app.request('/api/openapi.json')
    const doc = (await res.json()) as { paths: Record<string, unknown> }
    expect(Object.keys(doc.paths)).toContain('/api/me')
  })
})
