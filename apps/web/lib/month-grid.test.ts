import { describe, expect, it } from 'vitest'
import { addMonths, monthGrid } from './month-grid'

describe('monthGrid', () => {
  it('starts on Sunday and pads both ends', () => {
    const weeks = monthGrid('2026-10')
    expect(weeks).toHaveLength(5)
    // 1 Oct 2026 is a Thursday.
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03'])
    expect(weeks.at(-1)).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ])
  })

  it('handles February in leap years', () => {
    expect(monthGrid('2028-02').flat().filter(Boolean)).toHaveLength(29)
  })
})

describe('addMonths', () => {
  it('crosses years both ways', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
})
