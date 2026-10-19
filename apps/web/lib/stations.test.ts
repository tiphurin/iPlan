import { describe, expect, it } from 'vitest'
import { RAIL_GROUPS } from './lines'
import data from './stations.json'
import { type Station, cityStations, filterStations, stationLabel } from './stations'

const stations = data as Record<string, Station[]>

describe('stations', () => {
  it('has stations for every rail line in the picker', () => {
    for (const groups of Object.values(RAIL_GROUPS)) {
      for (const line of groups.flatMap((g) => g.lines)) {
        expect(stations[line.line]?.length, line.line).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('has the real stations in running order', () => {
    const silom = stations['BTS-SIL']?.map((s) => s.en)
    expect(silom?.slice(0, 3)).toEqual(['National Stadium', 'Siam', 'Ratchadamri'])
    expect(silom?.at(-1)).toBe('Bang Wa')
    expect(stations['BTS-SUK']?.some((s) => s.th === 'อโศก')).toBe(true)
    expect(stations['TYO-G']?.map((s) => s.en)).toContain('Ginza')
    expect(stations['2']?.map((s) => s.en)).toContain('Hongik University')
  })

  it('never lists a station twice on a line', () => {
    for (const [line, list] of Object.entries(stations)) {
      const names = list.map((s) => s.en.toLowerCase())
      expect(new Set(names).size, line).toBe(names.length)
    }
  })

  it('filters by any of the names', () => {
    const list: Station[] = [
      { en: 'Siam', local: 'สยาม', th: 'สยาม' },
      { en: 'Asok', local: 'อโศก', th: 'อโศก' },
    ]
    expect(filterStations(list, '')).toHaveLength(2)
    expect(filterStations(list, 'aso').map((s) => s.en)).toEqual(['Asok'])
    expect(filterStations(list, 'สยา').map((s) => s.en)).toEqual(['Siam'])
  })

  it('labels in Thai on Thai lines, English elsewhere, with the other script as a hint', () => {
    expect(stationLabel({ en: 'Siam', local: 'สยาม', th: 'สยาม' }, true)).toEqual({
      label: 'สยาม',
      hint: 'Siam',
    })
    expect(stationLabel({ en: 'Siam', local: 'สยาม', th: 'สยาม' }, false)).toEqual({
      label: 'Siam',
      hint: 'สยาม',
    })
    expect(stationLabel({ en: 'Bang Phai', local: 'บางไผ่' }, true)).toEqual({
      label: 'บางไผ่',
      hint: 'Bang Phai',
    })
    expect(stationLabel({ en: 'Myeongdong', local: '명동' }, true)).toEqual({
      label: 'Myeongdong',
      hint: '명동',
    })
  })

  it('lists a city network once per station with every line that stops there', () => {
    const city = cityStations(stations, [
      { line: 'BTS-SUK', badge: 'SUK' },
      { line: 'BTS-SIL', badge: 'SIL' },
    ])
    expect(city.find((s) => s.en === 'Siam')?.lines).toEqual(['SUK', 'SIL'])
    expect(city.find((s) => s.en === 'Siam')?.lineIds).toEqual(['BTS-SUK', 'BTS-SIL'])
    expect(city.find((s) => s.en === 'Asok')?.lines).toEqual(['SUK'])
    expect(new Set(city.map((s) => s.en)).size).toBe(city.length)
  })
})
