import { describe, expect, it } from 'vitest'
import { AppError } from '../../shared/errors'
import type { MeRepository, UserRow } from './me.repository'
import { MeService } from './me.service'

const row: UserRow = {
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

class FakeUsers implements MeRepository {
  rows = new Map([[row.id, { ...row }]])
  async findById(id: string) {
    return this.rows.get(id) ?? null
  }
  async update(id: string, changes: Partial<Pick<UserRow, 'name' | 'locale'>>) {
    const current = this.rows.get(id)
    if (!current) return null
    const next = { ...current, ...changes }
    this.rows.set(id, next)
    return next
  }
}

const actor = { id: 'u1', name: 'Demo Owner', email: 'dev@iplan.local', role: 'admin' as const }

describe('MeService', () => {
  it('returns the current user as a DTO', async () => {
    const me = await new MeService(new FakeUsers()).get(actor)
    expect(me).toEqual({
      id: 'u1',
      name: 'Demo Owner',
      email: 'dev@iplan.local',
      image: null,
      role: 'admin',
      locale: 'th',
      createdAt: '2026-10-01T00:00:00.000Z',
    })
  })

  it('updates language and name', async () => {
    const service = new MeService(new FakeUsers())
    expect((await service.update(actor, { locale: 'en' })).locale).toBe('en')
    expect((await service.update(actor, { name: 'Owner' })).name).toBe('Owner')
    expect((await service.update(actor, {})).name).toBe('Owner')
  })

  it('reports a missing user as NOT_FOUND', async () => {
    const service = new MeService(new FakeUsers())
    await expect(service.get({ ...actor, id: 'nobody' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    })
    await expect(service.get({ ...actor, id: 'nobody' })).rejects.toBeInstanceOf(AppError)
  })
})
