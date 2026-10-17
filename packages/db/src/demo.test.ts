import { isValidTimeZone, localDateKey } from '@iplan/core'
import { describe, expect, it } from 'vitest'
import { addDays, buildDemoTrip } from './demo'

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })
})

describe('buildDemoTrip', () => {
  const demo = buildDemoTrip('2026-10-23')

  it('starts the day before today so today is arrival day', () => {
    expect(demo.trip).toMatchObject({ startDate: '2026-10-22', endDate: '2026-10-27' })
  })

  it('keeps every item inside the trip and in a valid zone', () => {
    for (const item of demo.items) {
      expect(item.dayDate >= demo.trip.startDate && item.dayDate <= demo.trip.endDate).toBe(true)
      expect(isValidTimeZone(item.timeZone)).toBe(true)
      if (item.endsAt) expect(item.endsAt.getTime()).toBeGreaterThan(item.startsAt.getTime())
    }
  })

  it('places the overnight flight correctly across time zones', () => {
    const outbound = demo.items.find((i) => i.title === 'Flight BKK → ICN')
    // 02:25 Bangkok on 23 Oct = 19:25 UTC on 22 Oct; lands 10:00 Seoul = 01:00 UTC.
    expect(outbound?.dayDate).toBe('2026-10-22')
    expect(outbound?.startsAt.toISOString()).toBe('2026-10-22T19:25:00.000Z')
    expect(outbound?.endsAt?.toISOString()).toBe('2026-10-23T01:00:00.000Z')

    const inbound = demo.items.find((i) => i.title === 'Flight ICN → BKK')
    expect(inbound?.endsAt && localDateKey(inbound.endsAt, 'Asia/Bangkok')).toBe('2026-10-27')
  })

  it('lists items in time order', () => {
    const times = demo.items.map((i) => i.startsAt.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
})
