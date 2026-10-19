import { describe, expect, it } from 'vitest'
import { FailureLimiter, clientIp } from './rate-limit'
import { fingerprint } from './superadmin'

describe('FailureLimiter', () => {
  it('blocks after 5 failures for 15 minutes, then lets the key try again', () => {
    const limiter = new FailureLimiter()
    const t0 = 1_000_000
    for (let i = 0; i < 4; i++) limiter.fail('ip|admin', t0 + i)
    expect(limiter.retryAfter('ip|admin', t0 + 10)).toBe(0)
    limiter.fail('ip|admin', t0 + 10)
    expect(limiter.retryAfter('ip|admin', t0 + 20)).toBe(900)
    expect(limiter.retryAfter('other|admin', t0 + 20)).toBe(0)
    expect(limiter.retryAfter('ip|admin', t0 + 15 * 60_000 + 5)).toBe(0)
  })

  it('forgets failures after a successful sign-in', () => {
    const limiter = new FailureLimiter(2)
    limiter.fail('k', 1)
    limiter.fail('k', 2)
    expect(limiter.retryAfter('k', 3)).toBeGreaterThan(0)
    limiter.reset('k')
    expect(limiter.retryAfter('k', 3)).toBe(0)
  })
})

describe('clientIp', () => {
  it('takes the first forwarded address, then x-real-ip', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe(
      '203.0.113.9',
    )
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7')
    expect(clientIp(new Headers())).toBe('unknown')
  })
})

describe('superadmin fingerprint', () => {
  it('is keyed with the auth secret', () => {
    expect(fingerprint('1234', 'secret-a')).toMatch(/^hmac:[0-9a-f]{64}$/)
    expect(fingerprint('1234', 'secret-a')).not.toBe(fingerprint('1234', 'secret-b'))
  })
})
