import { describe, expect, it } from 'vitest'
import { baseToLocal, usableRate } from './money-convert'

describe('money-convert', () => {
  it('turns baht back into won with the saved rate', () => {
    expect(baseToLocal(48450n, 'THB', 'KRW', '0.0255')).toBe(19000n)
  })

  it('only uses positive decimal rates', () => {
    expect(usableRate({ KRW: '0.0255' }, 'KRW')).toBe('0.0255')
    expect(usableRate({ KRW: '0' }, 'KRW')).toBeUndefined()
    expect(usableRate({ KRW: 'abc' }, 'KRW')).toBeUndefined()
    expect(usableRate({}, 'KRW')).toBeUndefined()
    expect(usableRate({ KRW: '1' }, undefined)).toBeUndefined()
  })
})
