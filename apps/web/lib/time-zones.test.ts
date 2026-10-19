import { describe, expect, it } from 'vitest'
import { awayZone, zoneCurrency, zoneShort } from './time-zones'

describe('zone helpers', () => {
  it('names zones and their currency', () => {
    expect(zoneShort('Asia/Seoul')).toBe('KR')
    expect(zoneShort('Africa/Nairobi')).toBe('Nairobi')
    expect(zoneCurrency('Asia/Seoul')).toBe('KRW')
  })

  it('picks the most used zone away from home', () => {
    const items = ['Asia/Bangkok', 'Asia/Seoul', 'Asia/Seoul', 'Asia/Tokyo'].map((timeZone) => ({
      timeZone,
    }))
    expect(awayZone(items, 'Asia/Bangkok')).toBe('Asia/Seoul')
    expect(awayZone([{ timeZone: 'Asia/Bangkok' }], 'Asia/Bangkok')).toBeNull()
  })
})
