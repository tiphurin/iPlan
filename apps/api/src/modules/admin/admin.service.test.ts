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

  it('lets only the superadmin appoint admins and protects the superadmin', async () => {
    const { repo, service } = setup()
    const superadmin = { ...users.viewer, id: 'super', role: 'superadmin' as const }
    const [first] = repo.people
    if (!first) throw new Error('fixture')
    repo.people.push({ ...first, id: 'super', role: 'superadmin', name: 'Admin' })
    await expect(service.updateUser(admin, 'viewer', { role: 'admin' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect((await service.updateUser(superadmin, 'viewer', { role: 'admin' })).role).toBe('admin')
    // A plain admin can't suspend another admin; the superadmin can.
    await expect(service.updateUser(admin, 'viewer', { banned: true })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(service.updateUser(superadmin, 'viewer', { banned: true })).resolves.toMatchObject(
      {
        banned: true,
      },
    )
    await expect(service.updateUser(admin, 'super', { banned: true })).rejects.toMatchObject({
      code: 'SUPERADMIN_PROTECTED',
    })
    await expect(service.updateUser(admin, 'owner', { banned: true })).rejects.toMatchObject({
      code: 'CANNOT_CHANGE_SELF',
    })
    await expect(service.updateUser(admin, 'nobody', { status: 'active' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('puts people into circles', async () => {
    const { access, service } = setup()
    const circle = await access.createCircle('Family')
    const updated = await service.updateUser(admin, 'editor', { circleIds: [circle] })
    expect(updated.circleIds).toEqual([circle])
    await expect(
      service.updateUser(admin, 'editor', { circleIds: ['00000000-0000-4000-8000-00000000ffff'] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
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

  it('gives features to one person directly, on top of their groups', async () => {
    const { access, service } = setup()
    await access.setUserGroups('editor', [GROUP_IDS.travelers])
    const updated = await service.updateUser(admin, 'editor', { features: ['shared'] })
    expect(updated.features).toEqual(['shared'])
    expect((await access.featuresFor('editor')).sort()).toEqual(['shared', 'trips'])
    expect((await service.updateUser(admin, 'editor', { features: [] })).features).toEqual([])
    expect(await access.featuresFor('editor')).toEqual(['trips'])
  })

  it('lets only the superadmin change admins listed in ADMIN_EMAILS', async () => {
    const repo = new InMemoryAdmin()
    const access = new InMemoryAccess()
    const service = new AdminService(repo, access, new FakeAudit(), undefined, undefined, {
      adminEmails: ['Editor@Test'],
    })
    const superadmin = { ...users.viewer, id: 'super', role: 'superadmin' as const }
    for (const input of [
      { banned: true },
      { status: 'pending' as const },
      { features: ['shared' as const] },
      { groupIds: [] },
    ]) {
      await expect(service.updateUser(admin, 'editor', input)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    }
    expect(repo.people.find((p) => p.id === 'editor')).toMatchObject({ banned: false })
    await expect(service.updateUser(superadmin, 'editor', { banned: true })).resolves.toMatchObject(
      { banned: true },
    )
  })

  it("keeps plain admins away from the superadmin's groups, circles and features", async () => {
    const { repo, access, service } = setup()
    const [first] = repo.people
    if (!first) throw new Error('fixture')
    repo.people.push({ ...first, id: 'super', role: 'superadmin', name: 'Admin' })
    const circle = await access.createCircle('Family')
    for (const input of [
      { groupIds: [GROUP_IDS.full] },
      { circleIds: [circle] },
      { features: ['finance' as const] },
    ]) {
      await expect(service.updateUser(admin, 'super', input)).rejects.toMatchObject({
        code: 'SUPERADMIN_PROTECTED',
      })
    }
    expect((await access.circleIdsFor(['super'])).get('super')).toEqual([])
    const superadmin = { ...users.viewer, id: 'super', role: 'superadmin' as const }
    expect(
      (await service.updateUser(superadmin, 'super', { circleIds: [circle] })).circleIds,
    ).toEqual([circle])
  })

  it('checks everything before changing anything, then writes in one transaction', async () => {
    const repo = new InMemoryAdmin()
    const access = new InMemoryAccess()
    let transactions = 0
    const service = new AdminService(repo, access, new FakeAudit(), undefined, undefined, {
      transaction: async (work) => {
        transactions += 1
        return work({ admin: repo, access })
      },
    })
    await expect(
      service.updateUser(admin, 'stranger', {
        status: 'active',
        groupIds: [GROUP_IDS.travelers],
        circleIds: ['00000000-0000-4000-8000-00000000ffff'],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // The unknown circle stopped the approval and the groups too.
    expect(repo.people.find((p) => p.id === 'stranger')).toMatchObject({ status: 'pending' })
    expect(await access.featuresFor('stranger')).toEqual([])
    expect(transactions).toBe(0)
    await service.updateUser(admin, 'stranger', { status: 'active', groupIds: [GROUP_IDS.full] })
    expect(transactions).toBe(1)
  })
})
