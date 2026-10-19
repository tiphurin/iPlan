import { TRANSPORT_MODES } from '@iplan/contracts'
import { describe, expect, it } from 'vitest'
import {
  COUNTRIES,
  RAIL_GROUPS,
  countryOfLine,
  countryOfMode,
  countryOfZone,
  findPreset,
  modeOfLine,
  modesFor,
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
    expect(modeOfLine('2')).toBe('train')
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
})
