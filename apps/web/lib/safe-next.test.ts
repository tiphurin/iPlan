import { describe, expect, it } from 'vitest'
import { safeNext } from './safe-next'

describe('safeNext', () => {
  it('keeps local paths and rejects anything off-site', () => {
    expect(safeNext('/join/abc')).toBe('/join/abc')
    expect(safeNext('https://evil.com')).toBe('/')
    expect(safeNext('//evil.com')).toBe('/')
    expect(safeNext('/\\evil.com')).toBe('/')
    expect(safeNext(undefined)).toBe('/')
  })
})
