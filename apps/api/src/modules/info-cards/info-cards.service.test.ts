import { describe, expect, it } from 'vitest'
import { InMemoryInfoCards, seededTrip, users } from '../../testing/fakes'
import { InfoCardsService } from './info-cards.service'

describe('InfoCardsService', () => {
  it('creates, edits and deletes cards with editor rights', async () => {
    const { tripId, trips, audit } = await seededTrip()
    const service = new InfoCardsService(new InMemoryInfoCards(), trips, audit)
    const card = await service.create(users.editor, tripId, {
      kind: 'emergency',
      title: 'Emergency numbers',
      body: 'Police 112',
    })
    expect(await service.list(users.viewer, tripId)).toHaveLength(1)
    expect(
      (await service.update(users.owner, card.id, { body: 'Police 112\nFire 119' })).body,
    ).toContain('119')
    await expect(service.update(users.viewer, card.id, { title: 'x' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await service.remove(users.owner, card.id)
    expect(await service.list(users.owner, tripId)).toEqual([])
    expect(audit.entries.map((e) => e.action)).toContain('info.delete')
  })
})
