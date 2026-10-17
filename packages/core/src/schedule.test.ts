import { describe, expect, it } from 'vitest'
import {
  delayMinutes,
  durationParts,
  punctuality,
  scheduleStatus,
  sleepMinutes,
  timeline,
} from './schedule'

const at = (hhmm: string) => new Date(`2026-10-23T${hhmm}:00Z`)

const items = [
  { id: 'breakfast', startsAt: at('01:00'), endsAt: at('02:00') },
  { id: 'subway', startsAt: at('02:00'), endsAt: null },
  { id: 'museum', startsAt: at('02:30'), endsAt: at('05:00') },
  { id: 'sleep', startsAt: at('14:00'), endsAt: null },
]

describe('timeline', () => {
  it('fills open ends with the next start', () => {
    const line = timeline(items)
    expect(line.map((x) => x.item.id)).toEqual(['breakfast', 'subway', 'museum', 'sleep'])
    expect(line[1]?.end).toBe(at('02:30').getTime())
    expect(line[3]?.end).toBe(at('14:00').getTime())
  })
})

describe('scheduleStatus', () => {
  it('reports the current item, progress and what is next', () => {
    const status = scheduleStatus(items, at('03:45'))
    expect(status.current?.item.id).toBe('museum')
    expect(status.current?.progress).toBeCloseTo(0.5)
    expect(status.current?.remainingMs).toBe(75 * 60_000)
    expect(status.next).toEqual({ item: items[3], startsInMs: (10 * 60 + 15) * 60_000 })
    expect(status).toMatchObject({ completed: 2, total: 4, dayProgress: 0.5 })
  })

  it('handles before the first and after the last item', () => {
    expect(scheduleStatus(items, at('00:00'))).toMatchObject({
      current: null,
      next: { item: { id: 'breakfast' } },
      completed: 0,
    })
    expect(scheduleStatus(items, at('15:00'))).toMatchObject({
      current: null,
      next: null,
      completed: 4,
      dayProgress: 1,
    })
    expect(scheduleStatus([], at('00:00')).dayProgress).toBe(0)
  })

  it('has a gap with no current item', () => {
    const status = scheduleStatus(items, at('06:00'))
    expect(status.current).toBeNull()
    expect(status.next?.item.id).toBe('sleep')
  })
})

describe('punctuality', () => {
  it('measures delay against plan', () => {
    expect(delayMinutes(at('10:00'), at('10:12'))).toBe(12)
    expect(delayMinutes(at('10:00'), at('09:50'))).toBe(-10)
    expect(punctuality(12)).toBe('late')
    expect(punctuality(-10)).toBe('early')
    expect(punctuality(4)).toBe('on_time')
    expect(punctuality(4, 2)).toBe('late')
  })

  it('splits durations for countdowns', () => {
    expect(durationParts(90_061_000)).toEqual({
      negative: false,
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
    })
    expect(durationParts(-61_000)).toMatchObject({ negative: true, minutes: 1, seconds: 1 })
  })

  it('measures sleep', () => {
    expect(sleepMinutes(at('15:30'), new Date('2026-10-23T22:15:00Z'))).toBe(405)
    expect(sleepMinutes(at('10:00'), at('09:00'))).toBe(0)
  })
})
