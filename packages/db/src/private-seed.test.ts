import { describe, expect, it } from 'vitest'
import { type PrivateSeedFile, buildPrivateItems } from './private-seed'

/** Fictional sample; real files live in seed/private and never enter git. */
const sample: PrivateSeedFile = {
  format: 'iplan.private-seed',
  version: 1,
  users: [{ key: 'A', name: 'Traveller A', email: 'a@example.com', admin: true }],
  trip: {
    id: '00000000-0000-4000-8000-0000000000f1',
    name: 'Sample',
    startDate: '2026-10-22',
    endDate: '2026-10-27',
    homeTimeZone: 'Asia/Bangkok',
    baseCurrency: 'THB',
    owner: 'A',
  },
  items: [
    {
      day: '2026-10-22',
      kind: 'place',
      title: 'Lounge',
      tz: 'Asia/Bangkok',
      start: '23:45',
      end: '2026-10-23T01:15',
    },
    {
      day: '2026-10-23',
      kind: 'flight',
      title: 'Flight',
      tz: 'Asia/Bangkok',
      start: '02:25',
      end: '10:00',
      endTz: 'Asia/Seoul',
    },
  ],
}

describe('buildPrivateItems', () => {
  it('resolves local times, overnight ends and arrival zones', () => {
    const [lounge, flight] = buildPrivateItems(sample)
    expect(lounge?.startsAt.toISOString()).toBe('2026-10-22T16:45:00.000Z')
    expect(lounge?.endsAt?.toISOString()).toBe('2026-10-22T18:15:00.000Z')
    expect(flight?.startsAt.toISOString()).toBe('2026-10-22T19:25:00.000Z')
    expect(flight?.endsAt?.toISOString()).toBe('2026-10-23T01:00:00.000Z')
    expect(flight?.sortOrder).toBe(1)
  })

  it('names the item that is wrong', () => {
    const [lounge] = sample.items
    if (!lounge) throw new Error('sample has items')
    const bad = { ...sample, items: [{ ...lounge, day: '2026-11-30' }] }
    expect(() => buildPrivateItems(bad)).toThrow(/"Lounge".*outside the trip/)
    const backwards = { ...sample, items: [{ ...lounge, end: '20:00' }] }
    expect(() => buildPrivateItems(backwards)).toThrow(/ends before it starts/)
  })
})
