import type { TripItemDto } from '@iplan/contracts'
import { replanDay } from '@iplan/core'
import { describe, expect, it } from 'vitest'
import { retimePayload, toPlanItems } from './reorder'

const item = (
  id: string,
  kind: TripItemDto['kind'],
  start: string,
  end: string | null,
  details: TripItemDto['details'] = {},
): TripItemDto => ({
  id,
  tripId: 't',
  dayDate: '2026-10-24',
  kind,
  title: id,
  startsAt: `2026-10-24T${start}:00.000Z`,
  endsAt: end === null ? null : `2026-10-24T${end}:00.000Z`,
  timeZone: 'Asia/Seoul',
  notes: null,
  details,
  sortOrder: 0,
  checkIns: [],
})

const day = [
  item('palace', 'place', '03:15', '04:45'),
  item('train', 'move', '04:50', '05:00', { line: '3', verify: true }),
  item('market', 'place', '05:15', '07:00'),
  item('cafe', 'place', '07:00', '08:15', { fixed: false }),
]

describe('reorder payload', () => {
  it('reads fixed times and keeps ms precision', () => {
    const plan = toPlanItems([item('b', 'place', '10:00', null, { fixed: true })])
    expect(plan[0]).toEqual({
      id: 'b',
      kind: 'place',
      startsAt: Date.UTC(2026, 9, 24, 10, 0),
      endsAt: null,
      fixed: true,
    })
  })

  it('saves new times with the old start as a guard, and undo is its exact reverse', () => {
    const result = replanDay(toPlanItems(day), ['palace', 'cafe', 'market'])
    const { save, undo } = retimePayload(day, result)
    const saved = Object.fromEntries(save.map((c) => [c.id, c]))
    expect(saved.cafe).toEqual({
      id: 'cafe',
      expectStartsAt: '2026-10-24T07:00:00.000Z',
      startsAt: '2026-10-24T04:45:00.000Z',
      endsAt: '2026-10-24T06:00:00.000Z',
      verify: true,
    })
    expect(saved.train).toMatchObject({ startsAt: '2026-10-24T06:05:00.000Z', verify: true })
    // Undo starts from the saved times and restores the old ones and old marks.
    for (const u of undo) {
      const s = save.find((c) => c.id === u.id)
      const before = day.find((i) => i.id === u.id)
      expect(u.expectStartsAt).toBe(s?.startsAt)
      expect(u.startsAt).toBe(before?.startsAt)
      expect(u.endsAt).toBe(before?.endsAt)
    }
    expect(undo.find((u) => u.id === 'train')?.verify).toBe(true)
    expect(undo.find((u) => u.id === 'cafe')?.verify).toBe(false)
  })

  it('sends nothing when nothing changes', () => {
    const result = replanDay(toPlanItems(day), ['palace', 'market', 'cafe'])
    expect(retimePayload(day, result)).toEqual({ save: [], undo: [] })
  })
})
