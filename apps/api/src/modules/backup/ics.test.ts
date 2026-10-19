import { describe, expect, it } from 'vitest'
import { buildIcs, fold, icsText } from './ics'

describe('ics', () => {
  it('escapes text', () => {
    expect(icsText('Dinner, BBQ; 2nd floor\nback\\slash')).toBe(
      'Dinner\\, BBQ\\; 2nd floor\\nback\\\\slash',
    )
  })

  it('folds long lines at 75 octets without breaking Thai characters', () => {
    const line = `SUMMARY:${'ทดสอบ'.repeat(20)}`
    const folded = fold(line)
    for (const part of folded.split('\r\n'))
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })

  it('writes UTC events with a default 15-minute length', () => {
    const ics = buildIcs(
      'Seoul',
      [
        {
          uid: 'a@iplan',
          title: 'Flight BKK → ICN',
          start: new Date('2026-10-22T19:25:00Z'),
          end: new Date('2026-10-23T01:00:00Z'),
          location: 'BKK',
        },
        { uid: 'b@iplan', title: 'Wake up', start: new Date('2026-10-23T22:30:00Z') },
      ],
      new Date('2026-10-01T00:00:00Z'),
    )
    expect(ics).toContain('DTSTART:20261022T192500Z')
    expect(ics).toContain('DTEND:20261023T010000Z')
    expect(ics).toContain('DTEND:20261023T224500Z')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true)
  })
})

describe('map pins', () => {
  it('adds GEO and the Apple structured location when coordinates are known', () => {
    const ics = buildIcs('Trip', [
      {
        uid: 'a@iplan',
        title: 'Palace',
        start: new Date('2026-10-24T00:00:00Z'),
        location: 'Gyeongbokgung "main"',
        geo: { lat: 37.5796, lng: 126.977 },
      },
    ])
    expect(ics).toContain('GEO:37.5796;126.977')
    expect(ics.replace(/\r\n /g, '')).toContain(
      'X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-APPLE-RADIUS=100;X-TITLE="Gyeongbokgung  main ":geo:37.5796,126.977',
    )
  })
})
