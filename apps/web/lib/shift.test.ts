import { describe, expect, it } from 'vitest'
import { itemsToShift, minutesMoved, roundUpFive } from './shift'

const item = (id: string, startsAt: string, fixed = false, dayDate = '2026-10-23') => ({
  id,
  dayDate,
  startsAt,
  title: id,
  details: fixed ? { fixed: true } : {},
})

describe('shifting the rest of the day', () => {
  const items = [
    item('a', '2026-10-23T01:00:00Z'),
    item('b', '2026-10-23T02:00:00Z'),
    item('c', '2026-10-23T03:00:00Z'),
    item('flight', '2026-10-23T05:00:00Z', true),
    item('d', '2026-10-23T08:00:00Z'),
    item('tomorrow', '2026-10-24T01:00:00Z', false, '2026-10-24'),
  ]

  it('moves the items after the edited one, stopping before a fixed time', () => {
    const { move, stoppedAt } = itemsToShift(items, items[0] as never)
    expect(move.map((i) => i.id)).toEqual(['b', 'c'])
    expect(stoppedAt?.id).toBe('flight')
  })

  it('moves everything after when nothing is fixed, never other days', () => {
    const { move, stoppedAt } = itemsToShift(items, items[3] as never)
    expect(move.map((i) => i.id)).toEqual(['d'])
    expect(stoppedAt).toBeNull()
  })

  it('works out how far the end moved', () => {
    const before = {
      dayDate: 'x',
      startsAt: '2026-10-23T01:00:00Z',
      endsAt: '2026-10-23T01:30:00Z',
    }
    expect(minutesMoved(before, { ...before, endsAt: '2026-10-23T02:00:00Z' })).toBe(30)
    expect(minutesMoved(before, { ...before, endsAt: '2026-10-23T01:15:00Z' })).toBe(-15)
    expect(minutesMoved(before, before)).toBe(0)
    expect(minutesMoved(before, { ...before, dayDate: 'y', endsAt: '2026-10-23T03:00:00Z' })).toBe(
      0,
    )
    const noEnd = { dayDate: 'x', startsAt: '2026-10-23T01:00:00Z', endsAt: null }
    expect(minutesMoved(noEnd, { ...noEnd, startsAt: '2026-10-23T01:20:00Z' })).toBe(20)
  })

  it('rounds lateness up to 5 minutes', () => {
    expect([1, 5, 6, 14, 15].map(roundUpFive)).toEqual([5, 5, 10, 15, 15])
  })
})
