import { describe, expect, it } from 'vitest'
import { InMemoryChecklist, seededTrip, users } from '../../testing/fakes'
import { ChecklistService } from './checklist.service'

async function setup() {
  const { tripId, trips, audit } = await seededTrip()
  return { tripId, service: new ChecklistService(new InMemoryChecklist(), trips, audit) }
}

describe('ChecklistService', () => {
  it('lets editors add items and orders them within a group', async () => {
    const { tripId, service } = await setup()
    const a = await service.create(users.editor, tripId, {
      groupKey: 'documents',
      title: 'Passport',
    })
    const b = await service.create(users.owner, tripId, { groupKey: 'documents', title: 'Visa' })
    expect([a.sortOrder, b.sortOrder]).toEqual([0, 1])
    await expect(
      service.create(users.viewer, tripId, { groupKey: 'documents', title: 'x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('records who ticked, once per person, and lets viewers tick', async () => {
    const { tripId, service } = await setup()
    const item = await service.create(users.owner, tripId, {
      groupKey: 'packing',
      title: 'Charger',
    })
    await service.setTicked(users.viewer, item.id, true)
    await service.setTicked(users.viewer, item.id, true)
    const both = await service.setTicked(users.owner, item.id, true)
    expect(both.ticks.map((t) => t.name)).toEqual(['Viewer', 'Owner'])
    const after = await service.setTicked(users.viewer, item.id, false)
    expect(after.ticks.map((t) => t.userId)).toEqual(['owner'])
  })

  it('hides other trips and lets only editors delete', async () => {
    const { tripId, service } = await setup()
    const item = await service.create(users.owner, tripId, { groupKey: 'money', title: 'Cash' })
    await expect(service.list(users.stranger, tripId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.remove(users.viewer, item.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await service.remove(users.editor, item.id)
    expect(await service.list(users.owner, tripId)).toEqual([])
  })
})
