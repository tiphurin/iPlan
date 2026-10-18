import { describe, expect, it } from 'vitest'
import { isPrivateDevOrigin } from './auth'

describe('isPrivateDevOrigin', () => {
  it('accepts local-network http origins', () => {
    for (const origin of [
      'http://localhost:3000',
      'http://192.168.1.20:3000',
      'http://10.0.0.5:3000',
      'http://172.20.1.1:3000',
      'http://my-mac.local:3000',
    ]) {
      expect(isPrivateDevOrigin(origin)).toBe(true)
    }
  })

  it('rejects public, https and malformed origins', () => {
    for (const origin of [
      'http://example.com',
      'https://192.168.1.20:3000',
      'http://172.32.0.1:3000',
      'http://192.168.1.20.evil.com',
      'not a url',
      null,
    ]) {
      expect(isPrivateDevOrigin(origin)).toBe(false)
    }
  })
})
