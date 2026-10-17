import { describe, expect, it } from 'vitest'
import {
  TimeZoneError,
  formatOffset,
  fromLocalInput,
  isValidTimeZone,
  localDateKey,
  offsetMinutes,
  toLocalInput,
} from './time'

describe('time zones', () => {
  const departure = new Date('2026-10-22T19:25:00Z') // 02:25 on 23 Oct in Bangkok

  it('reads offsets', () => {
    expect(offsetMinutes(departure, 'Asia/Bangkok')).toBe(420)
    expect(offsetMinutes(departure, 'Asia/Seoul')).toBe(540)
    expect(offsetMinutes(departure, 'Asia/Kolkata')).toBe(330)
    expect(formatOffset(420)).toBe('UTC+7')
    expect(formatOffset(330)).toBe('UTC+5:30')
    expect(formatOffset(-180)).toBe('UTC-3')
  })

  it('gives the local calendar date per zone', () => {
    expect(localDateKey(departure, 'Asia/Bangkok')).toBe('2026-10-23')
    expect(localDateKey(departure, 'UTC')).toBe('2026-10-22')
  })

  it('round-trips datetime-local input values', () => {
    expect(toLocalInput(departure, 'Asia/Bangkok')).toBe('2026-10-23T02:25')
    expect(fromLocalInput('2026-10-23T02:25', 'Asia/Bangkok').toISOString()).toBe(
      departure.toISOString(),
    )
    expect(fromLocalInput('2026-10-23T10:00', 'Asia/Seoul').toISOString()).toBe(
      '2026-10-23T01:00:00.000Z',
    )
  })

  it('handles daylight saving transitions', () => {
    // 02:30 does not exist on 8 Mar 2026 in New York; resolves forward to 03:30 EDT.
    expect(fromLocalInput('2026-03-08T02:30', 'America/New_York').toISOString()).toBe(
      '2026-03-08T07:30:00.000Z',
    )
    // 01:30 happens twice on 1 Nov 2026; the earlier (EDT) instant wins.
    expect(fromLocalInput('2026-11-01T01:30', 'America/New_York').toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    )
  })

  it('validates input', () => {
    expect(isValidTimeZone('Asia/Seoul')).toBe(true)
    expect(isValidTimeZone('Mars/Base')).toBe(false)
    expect(() => localDateKey(departure, 'Mars/Base')).toThrow(TimeZoneError)
    expect(() => fromLocalInput('23/10/2026', 'Asia/Seoul')).toThrow(TimeZoneError)
  })
})
