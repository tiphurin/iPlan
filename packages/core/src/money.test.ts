import { describe, expect, it } from 'vitest'
import {
  MoneyError,
  addMoney,
  convertMoney,
  divRound,
  formatMoney,
  fractionDigits,
  money,
  parseMoney,
  sumMoney,
  toDecimalString,
} from './money'

describe('fractionDigits', () => {
  it('knows minor units per currency', () => {
    expect(fractionDigits('THB')).toBe(2)
    expect(fractionDigits('krw')).toBe(0)
    expect(fractionDigits('JPY')).toBe(0)
  })

  it('rejects invalid codes', () => {
    expect(() => fractionDigits('baht')).toThrow(MoneyError)
  })
})

describe('parseMoney / toDecimalString', () => {
  it('parses major units into minor units exactly', () => {
    expect(parseMoney('1,500.25', 'THB')).toEqual({ amount: 150025n, currency: 'THB' })
    expect(parseMoney('0.1', 'THB').amount).toBe(10n)
    expect(parseMoney('35000', 'KRW').amount).toBe(35000n)
    expect(parseMoney('-12.5', 'THB').amount).toBe(-1250n)
  })

  it('refuses extra decimals rather than rounding', () => {
    expect(() => parseMoney('10.5', 'KRW')).toThrow(/at most 0/)
    expect(() => parseMoney('1.234', 'THB')).toThrow(MoneyError)
    expect(() => parseMoney('abc', 'THB')).toThrow(/Not a number/)
  })

  it('round-trips', () => {
    for (const s of ['0.00', '0.05', '1500.25', '-3.10']) {
      expect(toDecimalString(parseMoney(s, 'THB'))).toBe(s)
    }
    expect(toDecimalString(money(35000n, 'KRW'))).toBe('35000')
  })

  it('handles amounts beyond Number precision', () => {
    const big = parseMoney('90071992547409931.23', 'THB')
    expect(toDecimalString(big)).toBe('90071992547409931.23')
  })
})

describe('arithmetic', () => {
  it('adds same-currency money', () => {
    expect(addMoney(money(100n, 'THB'), money(250n, 'THB')).amount).toBe(350n)
    expect(sumMoney([money(1n, 'THB'), money(2n, 'THB')], 'THB').amount).toBe(3n)
  })

  it('never mixes currencies', () => {
    expect(() => addMoney(money(1n, 'THB'), money(1n, 'KRW'))).toThrow(/mismatch/)
  })
})

describe('divRound', () => {
  it('rounds half away from zero', () => {
    expect(divRound(5n, 2n)).toBe(3n)
    expect(divRound(-5n, 2n)).toBe(-3n)
    expect(divRound(4n, 3n)).toBe(1n)
    expect(divRound(7n, -2n)).toBe(-4n)
  })
})

describe('convertMoney', () => {
  it('converts KRW to THB with the stored rate', () => {
    // 35,000 KRW at 0.0255 THB/KRW = 892.50 THB
    const thb = convertMoney(money(35000n, 'KRW'), { from: 'KRW', to: 'THB', rate: '0.0255' })
    expect(thb).toEqual({ amount: 89250n, currency: 'THB' })
  })

  it('converts THB to KRW and rounds to whole won', () => {
    // 100.01 THB at 39.2157 KRW/THB = 3921.962... → 3922 KRW
    const krw = convertMoney(money(10001n, 'THB'), { from: 'THB', to: 'KRW', rate: '39.2157' })
    expect(krw.amount).toBe(3922n)
  })

  it('checks the rate direction', () => {
    expect(() =>
      convertMoney(money(1n, 'THB'), { from: 'KRW', to: 'THB', rate: '0.0255' }),
    ).toThrow(/Rate is for KRW/)
    expect(() => convertMoney(money(1n, 'THB'), { from: 'THB', to: 'KRW', rate: '-1' })).toThrow(
      /Invalid rate/,
    )
  })
})

describe('formatMoney', () => {
  it('formats with the currency symbol', () => {
    expect(formatMoney(money(150025n, 'THB'), 'en-US')).toBe('THB\u00a01,500.25')
    expect(formatMoney(money(35000n, 'KRW'), 'en-US')).toBe('₩35,000')
  })
})
