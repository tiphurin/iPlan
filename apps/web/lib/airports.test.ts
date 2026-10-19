import { describe, expect, it } from 'vitest'
import { AIRPORTS, airportLabel, findAirports } from './airports'

describe('airports', () => {
  it('has unique three-letter codes', () => {
    const codes = AIRPORTS.map((a) => a.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(code).toMatch(/^[A-Z]{3}$/)
  })

  it('finds by code or name, trip country first', () => {
    expect(findAirports('bkk', 'KR').map((a) => a.code)).toEqual(['BKK'])
    expect(findAirports('icn', 'TH').map((a) => a.code)).toEqual(['ICN'])
    expect(findAirports('narita', 'TH').map((a) => a.code)).toEqual(['NRT'])
    expect(findAirports('สุวรรณ', 'TH').map((a) => a.code)).toEqual(['BKK'])
    const all = findAirports('', 'KR')
    expect(all[0]?.country).toBe('KR')
    expect(all.findIndex((a) => a.country === 'TH')).toBeLessThan(
      all.findIndex((a) => a.country === 'JP'),
    )
  })

  it('labels with the code', () => {
    const bkk = AIRPORTS.find((a) => a.code === 'BKK')
    expect(bkk && airportLabel(bkk, true)).toBe('สุวรรณภูมิ (BKK)')
    expect(bkk && airportLabel(bkk, false)).toBe('Suvarnabhumi (BKK)')
  })
})
