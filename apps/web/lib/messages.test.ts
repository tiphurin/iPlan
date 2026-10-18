import { ErrorCode } from '@iplan/contracts'
import { describe, expect, it } from 'vitest'
import en from '../messages/en.json'
import th from '../messages/th.json'

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

describe('messages', () => {
  it('Thai and English have exactly the same keys', () => {
    expect(keys(th).sort()).toEqual(keys(en).sort())
  })

  it('translate every API error code', () => {
    for (const code of ErrorCode.options) {
      expect(th.errors).toHaveProperty(code)
      expect(en.errors).toHaveProperty(code)
    }
  })
})
