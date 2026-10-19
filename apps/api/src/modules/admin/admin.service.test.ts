import { describe, expect, it } from 'vitest'
import { FakeAudit, InMemoryAdmin, users } from '../../testing/fakes'
import { AdminService } from './admin.service'

const admin = { ...users.owner, role: 'admin' as const }

function setup() {
  const repo = new InMemoryAdmin()
  const audit = new FakeAudit()
  return { repo, audit, service: new AdminService(repo, audit) }
}

describe('AdminService', () => {
  it('is closed to non-admins', async () => {
    const { service } = setup()
    await expect(service.stats(users.editor)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.users(users.editor, undefined, 1)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('searches users by name or email', async () => {
    const { service } = setup()
    expect((await service.users(admin, 'Viewer', 1)).users.map((u) => u.id)).toEqual(['viewer'])
    expect((await service.users(admin, undefined, 1)).total).toBe(4)
  })

  it('suspends a user, signs them out everywhere and logs it', async () => {
    const { repo, audit, service } = setup()
    const updated = await service.updateUser(admin, 'editor', { banned: true, banReason: 'Spam' })
    expect(updated).toMatchObject({ banned: true, banReason: 'Spam' })
    expect(repo.sessions.has('editor')).toBe(false)
    expect(audit.entries.at(-1)).toMatchObject({ action: 'admin.suspend', entityId: 'editor' })
    const lifted = await service.updateUser(admin, 'editor', { banned: false })
    expect(lifted).toMatchObject({ banned: false, banReason: null })
  })

  it('changes roles but never lets an admin lock themselves out', async () => {
    const { service } = setup()
    expect((await service.updateUser(admin, 'viewer', { role: 'admin' })).role).toBe('admin')
    await expect(service.updateUser(admin, 'owner', { role: 'user' })).rejects.toMatchObject({
      code: 'CANNOT_CHANGE_SELF',
    })
    await expect(service.updateUser(admin, 'owner', { banned: true })).rejects.toMatchObject({
      code: 'CANNOT_CHANGE_SELF',
    })
    await expect(service.updateUser(admin, 'nobody', { role: 'user' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
