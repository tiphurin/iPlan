import { TRIP_COLORS } from '@iplan/contracts'
import { describe, expect, it } from 'vitest'
import { coverColor, suggestTripColor, tripColor } from './trip-color'

describe('trip colours', () => {
  it('falls back to a stable palette colour from the id', () => {
    const id = '7bb506b5-1efa-4216-866d-1a39b8da1210'
    expect(TRIP_COLORS).toContain(tripColor(id))
    expect(tripColor(id)).toBe(tripColor(id))
    expect(coverColor({ id, color: null })).toBe(tripColor(id))
    expect(coverColor({ id, color: '#d6453d' })).toBe('#d6453d')
  })

  it('suggests the least used colour for a new trip', () => {
    expect(suggestTripColor([])).toBe(TRIP_COLORS[0])
    expect(
      suggestTripColor([
        { id: 'a', color: TRIP_COLORS[0] },
        { id: 'b', color: TRIP_COLORS[1] },
      ]),
    ).toBe(TRIP_COLORS[2])
  })
})
