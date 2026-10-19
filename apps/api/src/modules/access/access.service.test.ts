import { describe, expect, it } from 'vitest'
import { FakeAudit, GROUP_IDS, InMemoryAccess, users } from '../../testing/fakes'
import { AccessService } from './access.service'

const admin = { ...users.owner, role: 'admin' as const }

function setup() {
  const repo = new InMemoryAccess()
  const audit = new FakeAudit()
  return { repo, audit, service: new AccessService(repo, audit) }
}

describe('AccessService', () => {
  it('grants features through groups; admins get all, pending accounts none', async () => {
    const { repo, service } = setup()
    await repo.setUserGroups('editor', [GROUP_IDS.travelers])
    expect(await service.featuresFor({ ...users.editor, status: 'active' })).toEqual(['trips'])
    expect(await service.featuresFor({ ...users.viewer, status: 'active' })).toEqual([
      'trips',
      'finance',
    ])
    expect(await service.featuresFor({ ...users.stranger, status: 'active' })).toEqual([])
    expect(await service.featuresFor({ ...users.viewer, status: 'pending' })).toEqual([])
    expect(await service.featuresFor({ ...admin, status: 'active' })).toEqual([
      'trips',
      'finance',
      'shared',
    ])
  })

  it('refuses a feature the user was not granted', async () => {
    const { repo, service } = setup()
    await repo.setUserGroups('editor', [GROUP_IDS.travelers])
    await expect(service.requireFeature(users.editor, 'trips')).resolves.toBeUndefined()
    await expect(service.requireFeature(users.editor, 'finance')).rejects.toMatchObject({
      code: 'FEATURE_DISABLED',
      status: 403,
    })
  })

  it('ignores feature keys that no longer exist in code', async () => {
    const { repo, service } = setup()
    repo.features.set(GROUP_IDS.travelers, ['trips', 'retired-feature'])
    const [travelers] = (await service.groups(admin)).filter((g) => g.name === 'Travelers')
    expect(travelers?.features).toEqual(['trips'])
  })

  it('lets admins create, rename, re-scope and delete groups', async () => {
    const { audit, service } = setup()
    await expect(service.groups(users.editor)).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const family = await service.createGroup(admin, { name: 'Family', features: ['finance'] })
    expect(family).toMatchObject({ name: 'Family', features: ['finance'], memberCount: 0 })
    await expect(
      service.createGroup(admin, { name: 'family', features: [] }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    const renamed = await service.updateGroup(admin, family.id, {
      name: 'Home',
      features: ['trips', 'finance'],
    })
    expect(renamed).toMatchObject({ name: 'Home', features: ['trips', 'finance'] })

    await service.deleteGroup(admin, family.id)
    expect((await service.groups(admin)).map((g) => g.name)).toEqual(['Travelers', 'Full access'])
    expect(audit.entries.map((e) => e.action)).toEqual([
      'group.create',
      'group.update',
      'group.delete',
    ])
  })
})
