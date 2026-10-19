import { describe, expect, it } from 'vitest'
import { parseDetails } from './items.mapper'

describe('parseDetails', () => {
  it('keeps valid keys when one stored key no longer parses', () => {
    expect(
      parseDetails({
        address: '161 Sajik-ro',
        lat: 37.5,
        lineColor: 'green',
        legacyNote: 'kept',
        url: 'javascript:alert(1)',
      }),
    ).toEqual({ address: '161 Sajik-ro', lat: 37.5, legacyNote: 'kept' })
  })

  it('only keeps http(s) links', () => {
    expect(parseDetails({ url: 'https://example.com/a' })).toEqual({
      url: 'https://example.com/a',
    })
    expect(parseDetails({ url: 'data:text/html,hi' })).toEqual({})
  })

  it('treats non-objects as empty details', () => {
    expect(parseDetails(null)).toEqual({})
    expect(parseDetails(['x'])).toEqual({})
  })
})
