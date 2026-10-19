import { describe, expect, it } from 'vitest'
import { FakeAudit, GROUP_IDS, InMemoryAccess, InMemoryAdmin, users } from '../../testing/fakes'
import { AdminService } from './admin.service'

const admin = { ...users.owner, role: 'admin' as const }

function setup() {
  const repo = new InMemoryAdmin()
  const access = new InMemoryAccess()
  const audit = new FakeAudit()
  return { repo, access, audit, service: new AdminService(repo, access, audit) }
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

  it('lists the waiting list and approves into a group', async () => {
    const { access, audit, service } = setup()
    const waiting = await service.users(admin, undefined, 1, 'pending')
    expect(waiting.users.map((u) => u.id)).toEqual(['stranger'])
    expect(waiting.users[0]).toMatchObject({ status: 'pending', groupIds: [] })

    const approved = await service.updateUser(admin, 'stranger', {
      status: 'active',
      groupIds: [GROUP_IDS.travelers],
    })
    expect(approved).toMatchObject({ status: 'active', groupIds: [GROUP_IDS.travelers] })
    expect(await access.featuresFor('stranger')).toEqual(['trips'])
    expect(audit.entries.at(-1)).toMatchObject({ action: 'admin.approve', entityId: 'stranger' })
  })

  it('rejects unknown groups and never sends an admin back to the waiting list', async () => {
    const { service } = setup()
    await expect(
      service.updateUser(admin, 'viewer', { groupIds: ['00000000-0000-4000-8000-00000000ffff'] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.updateUser(admin, 'owner', { status: 'pending' })).rejects.toMatchObject({
      code: 'CANNOT_CHANGE_SELF',
    })
  })
})
