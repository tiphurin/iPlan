import { describe, expect, it } from 'vitest'
import { itemsToShift, minutesMoved, previousItem, roundUpFive, shiftOverlap } from './shift'

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

describe('previousItem', () => {
  const at = (id: string, dayDate: string, startsAt: string) => ({ id, dayDate, startsAt })
  const items = [
    at('a', '2026-10-24', '2026-10-24T01:00:00.000Z'),
    at('b', '2026-10-24', '2026-10-24T03:00:00.000Z'),
    at('c', '2026-10-24', '2026-10-24T05:00:00.000Z'),
    at('x', '2026-10-25', '2026-10-24T04:00:00.000Z'),
  ]
  it('finds the item just before, on the same plan day, never the item itself', () => {
    expect(
      previousItem(items, {
        dayDate: '2026-10-24',
        before: '2026-10-24T05:00:00.000Z',
        excludeId: 'c',
      })?.id,
    ).toBe('b')
    expect(
      previousItem(items, { dayDate: '2026-10-24', before: '2026-10-24T01:00:00.000Z' }),
    ).toBeNull()
  })
  it('is the last item of the day for a new item', () => {
    expect(previousItem(items, { dayDate: '2026-10-24' })?.id).toBe('c')
    expect(previousItem(items, { dayDate: '2026-10-26' })).toBeNull()
  })
})

describe('shiftOverlap', () => {
  const fixed = { startsAt: '2026-10-24T11:10:00.000Z' }
  const moved = [{ startsAt: '2026-10-24T09:05:00.000Z', endsAt: '2026-10-24T11:10:00.000Z' }]
  it('counts how far the last moved item runs into the fixed one', () => {
    expect(shiftOverlap(moved, 20, fixed)).toBe(20)
    expect(shiftOverlap(moved, -10, fixed)).toBe(0)
    expect(shiftOverlap(moved, 0, fixed)).toBe(0)
  })
  it('uses the start when the item has no end, and is 0 with nothing to hit', () => {
    expect(shiftOverlap([{ startsAt: '2026-10-24T11:00:00.000Z' }], 15, fixed)).toBe(5)
    expect(shiftOverlap(moved, 20, null)).toBe(0)
    expect(shiftOverlap([], 20, fixed)).toBe(0)
  })
})
