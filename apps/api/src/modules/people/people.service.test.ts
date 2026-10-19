import { describe, expect, it } from 'vitest'
import { InMemoryAccess, InMemoryPeople, users } from '../../testing/fakes'
import { PeopleService } from './people.service'

describe('PeopleService', () => {
  it('finds only people who share a circle; admins find everyone approved', async () => {
    const access = new InMemoryAccess()
    const service = new PeopleService(new InMemoryPeople(access))
    const family = await access.createCircle('Family')
    await access.setUserCircles(users.owner.id, [family])
    await access.setUserCircles(users.editor.id, [family])

    expect((await service.search(users.owner, 'test')).map((p) => p.id)).toEqual(['editor'])
    expect(await service.search(users.viewer, 'test')).toEqual([])
    const admin = { ...users.viewer, role: 'admin' as const }
    // Pending people never show up.
    expect((await service.search(admin, 'test')).map((p) => p.id)).toEqual(['owner', 'editor'])
  })
})
