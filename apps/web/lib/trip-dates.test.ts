import { describe, expect, it } from 'vitest'
import { tripDays, tripPhase } from './trip-dates'

describe('trip helpers', () => {
  it('lists every day of the trip', () => {
    expect(tripDays('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
  })

  it('classifies trips relative to today', () => {
    const trip = { startDate: '2026-10-22', endDate: '2026-10-27' }
    expect(tripPhase(trip, '2026-10-01')).toBe('upcoming')
    expect(tripPhase(trip, '2026-10-22')).toBe('ongoing')
    expect(tripPhase(trip, '2026-10-28')).toBe('past')
  })
})
