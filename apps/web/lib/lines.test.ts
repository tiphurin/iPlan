import { TRANSPORT_MODES } from '@iplan/contracts'
import { describe, expect, it } from 'vitest'
import {
  COUNTRIES,
  RAIL_GROUPS,
  countryOfLine,
  countryOfMode,
  countryOfZone,
  findPreset,
  countryLines,
  endpointKind,
  isRailLine,
  lineBadge,
  modeOfLine,
  modesFor,
  stationArea,
} from './lines'

describe('transport by country', () => {
  it('suggests the country from the time zone', () => {
    expect(countryOfZone('Asia/Bangkok')).toBe('TH')
    expect(countryOfZone('Asia/Seoul')).toBe('KR')
    expect(countryOfZone('Asia/Tokyo')).toBe('JP')
    expect(countryOfZone('Asia/Taipei')).toBe('TW')
    expect(countryOfZone('Europe/Paris')).toBe('OTHER')
    expect(countryOfZone(undefined)).toBe('OTHER')
  })

  it('only offers a country its own ride apps and rail lines', () => {
    const modes = (c: (typeof COUNTRIES)[number]) => modesFor(c).map((p) => p.mode)
    expect(modes('TH')).toEqual(expect.arrayContaining(['grab', 'bolt', 'lineman']))
    expect(modes('KR')).toContain('kakao_t')
    for (const c of ['KR', 'JP', 'TW', 'OTHER'] as const) {
      expect(modes(c)).not.toContain('grab')
      expect(modes(c)).not.toContain('lineman')
    }
    expect(modes('TH')).not.toContain('kakao_t')
    for (const c of COUNTRIES) {
      expect(modes(c)).toEqual(expect.arrayContaining(['walk', 'taxi', 'bus', 'train']))
      for (const group of RAIL_GROUPS[c]) {
        for (const line of group.lines) expect(line.country).toBe(c)
      }
    }
    expect(RAIL_GROUPS.OTHER).toEqual([])
  })

  it('keeps line ids unique across countries', () => {
    const ids = Object.values(RAIL_GROUPS).flatMap((g) =>
      g.flatMap((x) => x.lines.map((l) => l.line)),
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('still reads Seoul lines saved before countries existed', () => {
    expect(findPreset('2', '#00a84d')?.country).toBe('KR')
    expect(countryOfLine('AREX')).toBe('KR')
    expect(modeOfLine('2')).toBe('metro')
  })

  it('maps lines and expense kinds back to their country', () => {
    expect(countryOfLine('BTS-SUK')).toBe('TH')
    expect(countryOfLine('TYO-G')).toBe('JP')
    expect(countryOfLine('TPE-R')).toBe('TW')
    expect(countryOfLine('TAXI')).toBeUndefined()
    expect(countryOfMode('grab')).toBe('TH')
    expect(countryOfMode('kakao_t')).toBe('KR')
    expect(countryOfMode('taxi')).toBeUndefined()
  })

  it('every preset mode is a valid expense kind', () => {
    for (const c of COUNTRIES) {
      for (const p of modesFor(c)) expect(TRANSPORT_MODES).toContain(p.mode)
    }
  })

  it('every ride gets a start and end of the right kind', () => {
    expect(isRailLine('BTS-SUK')).toBe(true)
    expect(isRailLine('2')).toBe(true)
    expect(isRailLine('TAXI')).toBe(false)
    expect(isRailLine('TRAIN')).toBe(false)
    expect(endpointKind('TYO-G')).toBe('line')
    expect(endpointKind('METRO')).toBe('city')
    expect(endpointKind('TRAIN')).toBe('station')
    expect(endpointKind('SHINKANSEN')).toBe('station')
    expect(endpointKind('FLY')).toBe('airport')
    // Every other way of getting around still gets a start and end place.
    for (const mode of ['TAXI', 'GRAB', 'W', 'BUS', 'car', 'BOAT', 'A1 bus']) {
      expect(endpointKind(mode)).toBe('place')
    }
    expect(endpointKind('')).toBeNull()
    expect(endpointKind(undefined)).toBeNull()
    expect(countryLines('TH').map((l) => l.badge)).toContain('SUK')
    expect(countryLines('OTHER')).toEqual([])
  })

  it('searches stations near the line city, else the country city', () => {
    expect(stationArea('OSA-M', 'JP')?.lat).toBeCloseTo(34.69, 1)
    expect(stationArea('TRAIN', 'JP')?.lat).toBeCloseTo(35.68, 1)
    expect(stationArea('TRAIN', 'TH')?.lng).toBeCloseTo(100.54, 1)
    expect(stationArea('TRAIN', 'OTHER')).toBeUndefined()
  })

  it('shows a short badge for prefixed line ids', () => {
    expect(lineBadge('BTS-SUK')).toBe('SUK')
    expect(lineBadge('2')).toBe('2')
    expect(lineBadge('My line')).toBe('My line')
  })
})
