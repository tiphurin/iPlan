import { describe, expect, it } from 'vitest'
import { googleCalendarUrl } from './calendar'

describe('googleCalendarUrl', () => {
  it('builds a template link with UTC times', () => {
    const url = new URL(
      googleCalendarUrl({
        title: 'Gyeongbokgung Palace',
        startsAt: '2026-10-23T05:30:00.000Z',
        endsAt: '2026-10-23T08:30:00.000Z',
        notes: null,
        details: { address: '161 Sajik-ro, Seoul' },
      }),
    )
    expect(url.searchParams.get('dates')).toBe('20261023T053000Z/20261023T083000Z')
    expect(url.searchParams.get('location')).toBe('161 Sajik-ro, Seoul')
  })

  it('gives instant items 15 minutes', () => {
    const url = new URL(
      googleCalendarUrl({
        title: 'Wake up',
        startsAt: '2026-10-23T22:30:00Z',
        endsAt: null,
        notes: null,
        details: {},
      }),
    )
    expect(url.searchParams.get('dates')).toBe('20261023T223000Z/20261023T224500Z')
  })
})
