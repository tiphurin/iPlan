import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../../testing/fakes'
import { AVATAR_MAX_BYTES } from '../../shared/avatar'
import { AppError } from '../../shared/errors'
import type { MeRepository, UserChanges, UserRow } from './me.repository'
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
  status: 'active',
  avatarKey: null,
  nickname: null,
  mustChangePassword: false,
  bootstrapSecretHash: null,
}

class FakeUsers implements MeRepository {
  rows = new Map([[row.id, { ...row }]])
  async findById(id: string) {
    return this.rows.get(id) ?? null
  }
  async hasPassword() {
    return false
  }
  async update(id: string, changes: UserChanges) {
    const current = this.rows.get(id)
    if (!current) return null
    const next = { ...current, ...changes }
    this.rows.set(id, next)
    return next
  }
}

const actor = {
  id: 'u1',
  name: 'Demo Owner',
  email: 'dev@iplan.local',
  role: 'admin' as const,
  status: 'active' as const,
}
const access = { featuresFor: async () => ['trips' as const] }

describe('MeService', () => {
  it('returns the current user as a DTO', async () => {
    const me = await new MeService(new FakeUsers(), access).get(actor)
    expect(me).toEqual({
      id: 'u1',
      name: 'Demo Owner',
      email: 'dev@iplan.local',
      image: null,
      role: 'admin',
      status: 'active',
      features: ['trips'],
      locale: 'th',
      nickname: null,
      hasPassword: false,
      mustChangePassword: false,
      createdAt: '2026-10-01T00:00:00.000Z',
    })
  })

  it('updates language and name', async () => {
    const service = new MeService(new FakeUsers(), access)
    expect((await service.update(actor, { locale: 'en' })).locale).toBe('en')
    expect((await service.update(actor, { name: 'Owner' })).name).toBe('Owner')
    expect((await service.update(actor, {})).name).toBe('Owner')
    expect((await service.update(actor, { nickname: 'Tom' })).nickname).toBe('Tom')
    expect((await service.update(actor, { nickname: '' })).nickname).toBeNull()
  })

  it('reports a missing user as NOT_FOUND', async () => {
    const service = new MeService(new FakeUsers(), access)
    await expect(service.get({ ...actor, id: 'nobody' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    })
    await expect(service.get({ ...actor, id: 'nobody' })).rejects.toBeInstanceOf(AppError)
  })

  it('stores an uploaded picture and replaces the old one', async () => {
    const storage = new MemoryStorage()
    const service = new MeService(new FakeUsers(), access, storage)
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    const first = await service.setAvatar(actor, webp)
    expect(first.image).toMatch(/^\/api\/users\/u1\/avatar\?v=/)
    const second = await service.setAvatar(actor, webp)
    expect(second.image).not.toBe(first.image)
    expect(storage.files.size).toBe(1)
    expect([...storage.files.keys()][0]).toMatch(/\.webp$/)
    expect((await service.removeAvatar(actor)).image).toBeNull()
    expect(storage.files.size).toBe(0)
  })

  it('checks the picture by its bytes, its size and the account state', async () => {
    const storage = new MemoryStorage()
    const service = new MeService(new FakeUsers(), access, storage)
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect((await service.setAvatar(actor, png)).image).toMatch(/avatar/)
    // HTML or a PDF declared as an image is refused.
    for (const bytes of [
      new TextEncoder().encode('<svg onload=alert(1)>'),
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    ]) {
      await expect(service.setAvatar(actor, bytes)).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      })
    }
    const huge = new Uint8Array(AVATAR_MAX_BYTES + 1)
    huge.set(png)
    await expect(service.setAvatar(actor, huge)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
    await expect(
      service.setAvatar({ ...actor, role: 'user', status: 'pending' }, png),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
