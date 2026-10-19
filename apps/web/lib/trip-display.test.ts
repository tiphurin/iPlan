import { describe, expect, it } from 'vitest'
import { otherZone, shownZone } from './trip-display'

const zones = { home: 'Asia/Bangkok', away: 'Asia/Seoul' }

describe('which zone times are shown in', () => {
  it('KR shows everything in Seoul time, even items still in Bangkok', () => {
    expect(shownZone('local', 'Asia/Bangkok', zones)).toBe('Asia/Seoul')
    expect(shownZone('local', 'Asia/Seoul', zones)).toBe('Asia/Seoul')
    expect(otherZone('local', 'Asia/Bangkok', zones)).toBe('Asia/Bangkok')
  })

  it('TH shows everything in Bangkok time', () => {
    expect(shownZone('home', 'Asia/Seoul', zones)).toBe('Asia/Bangkok')
    expect(otherZone('home', 'Asia/Seoul', zones)).toBe('Asia/Seoul')
  })

  it('a trip with no away zone keeps each item in its own zone', () => {
    const domestic = { home: 'Asia/Bangkok', away: null }
    expect(shownZone('local', 'Asia/Bangkok', domestic)).toBe('Asia/Bangkok')
    expect(otherZone('home', 'Asia/Bangkok', domestic)).toBe('Asia/Bangkok')
  })
})
