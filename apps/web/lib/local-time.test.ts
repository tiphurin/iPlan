import { describe, expect, it } from 'vitest'
import { addMinutesLocal, minutesBetweenLocal, parseTypedTime } from './local-time'

describe('parseTypedTime', () => {
  it('reads the ways people type a time', () => {
    expect(parseTypedTime('1015')).toBe('10:15')
    expect(parseTypedTime('10:15')).toBe('10:15')
    expect(parseTypedTime('10.15')).toBe('10:15')
    expect(parseTypedTime('915')).toBe('09:15')
    expect(parseTypedTime('9:05')).toBe('09:05')
    expect(parseTypedTime('9')).toBe('09:00')
    expect(parseTypedTime('21')).toBe('21:00')
    expect(parseTypedTime('0000')).toBe('00:00')
    expect(parseTypedTime(' 2359 ')).toBe('23:59')
  })

  it('refuses what is not a time of day', () => {
    for (const bad of ['', '24', '2400', '1060', '12345', 'ab', '10:5', '-1', '10:15:00']) {
      expect(parseTypedTime(bad)).toBeNull()
    }
  })
})

describe('addMinutesLocal', () => {
  it('adds and subtracts across hours, midnight, months and years', () => {
    expect(addMinutesLocal('2026-10-24T10:15', 15)).toBe('2026-10-24T10:30')
    expect(addMinutesLocal('2026-10-24T10:15', -20)).toBe('2026-10-24T09:55')
    expect(addMinutesLocal('2026-10-24T23:50', 20)).toBe('2026-10-25T00:10')
    expect(addMinutesLocal('2026-10-25T00:05', -10)).toBe('2026-10-24T23:55')
    expect(addMinutesLocal('2026-10-31T23:30', 60)).toBe('2026-11-01T00:30')
    expect(addMinutesLocal('2026-12-31T23:59', 1)).toBe('2027-01-01T00:00')
  })

  it('returns null for a malformed value', () => {
    expect(addMinutesLocal('2026-10-24', 5)).toBeNull()
  })
})

describe('minutesBetweenLocal', () => {
  it('counts minutes, also over midnight', () => {
    expect(minutesBetweenLocal('2026-10-24T10:15', '2026-10-24T11:45')).toBe(90)
    expect(minutesBetweenLocal('2026-10-24T23:30', '2026-10-25T00:15')).toBe(45)
    expect(minutesBetweenLocal('2026-10-24T11:00', '2026-10-24T10:00')).toBe(-60)
    expect(minutesBetweenLocal('x', '2026-10-24T10:00')).toBeNull()
  })
})
