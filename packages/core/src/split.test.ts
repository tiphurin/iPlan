import { describe, expect, it } from 'vitest'
import {
  SplitError,
  computeBalances,
  settle,
  splitByWeights,
  splitEqual,
  splitExact,
  splitPercent,
} from './split'

const sum = (shares: Record<string, bigint>) => Object.values(shares).reduce((a, b) => a + b, 0n)

describe('splitEqual', () => {
  it('splits evenly and hands out the remainder in order', () => {
    expect(splitEqual(1000n, ['a', 'b', 'c'])).toEqual({ a: 334n, b: 333n, c: 333n })
    expect(splitEqual(-1000n, ['a', 'b', 'c'])).toEqual({ a: -334n, b: -333n, c: -333n })
  })

  it('always adds up to the total', () => {
    for (const total of [0n, 1n, 7n, 99_999n]) {
      expect(sum(splitEqual(total, ['a', 'b', 'c', 'd']))).toBe(total)
    }
  })

  it('needs unique members', () => {
    expect(() => splitEqual(10n, [])).toThrow(SplitError)
    expect(() => splitEqual(10n, ['a', 'a'])).toThrow(/Duplicate/)
  })
})

describe('splitExact', () => {
  it('accepts amounts that match the total (2,000 meal: A 1,500)', () => {
    expect(splitExact(200000n, { a: 150000n, b: 50000n })).toEqual({ a: 150000n, b: 50000n })
  })

  it('rejects amounts that do not add up', () => {
    expect(() => splitExact(200000n, { a: 150000n, b: 40000n })).toThrow(/190000/)
  })
})

describe('splitPercent', () => {
  it('splits by basis points with largest remainder rounding', () => {
    expect(splitPercent(1000n, { a: 7000, b: 3000 })).toEqual({ a: 700n, b: 300n })
    const thirds = splitPercent(100n, { a: 3333, b: 3333, c: 3334 })
    expect(sum(thirds)).toBe(100n)
    expect(thirds).toEqual({ a: 33n, b: 33n, c: 34n })
  })

  it('requires exactly 100%', () => {
    expect(() => splitPercent(100n, { a: 5000, b: 4000 })).toThrow(/90%/)
    expect(() => splitPercent(100n, { a: 10000.5 })).toThrow(SplitError)
  })
})

describe('balances and settlement', () => {
  it('works out who owes whom', () => {
    const balances = computeBalances([
      { paidBy: 'a', amount: 3000n, shares: splitEqual(3000n, ['a', 'b', 'c']) },
      { paidBy: 'b', amount: 600n, shares: splitEqual(600n, ['a', 'b', 'c']) },
    ])
    expect(balances).toEqual({ a: 1800n, b: -600n, c: -1200n })
    expect(settle(balances)).toEqual([
      { from: 'c', to: 'a', amount: 1200n },
      { from: 'b', to: 'a', amount: 600n },
    ])
  })

  it('treats a shared pool as a party', () => {
    const balances = computeBalances([
      { paidBy: 'pool', amount: 1000n, shares: { a: 500n, b: 500n } },
    ])
    expect(settle(balances)).toEqual([
      { from: 'a', to: 'pool', amount: 500n },
      { from: 'b', to: 'pool', amount: 500n },
    ])
  })

  it('needs at most n-1 transfers and settles everything', () => {
    const balances = { a: 500n, b: 300n, c: -100n, d: -250n, e: -450n }
    const transfers = settle(balances)
    expect(transfers.length).toBeLessThanOrEqual(4)
    const after: Record<string, bigint> = { ...balances }
    for (const t of transfers) {
      after[t.from] = (after[t.from] ?? 0n) + t.amount
      after[t.to] = (after[t.to] ?? 0n) - t.amount
    }
    expect(Object.values(after).every((v) => v === 0n)).toBe(true)
  })

  it('rejects inconsistent input', () => {
    expect(() => computeBalances([{ paidBy: 'a', amount: 10n, shares: { a: 5n } }])).toThrow()
    expect(() => settle({ a: 5n })).toThrow(/net to zero/)
  })
})

describe('splitByWeights', () => {
  it('keeps proportions and the exact total', () => {
    // 35,000 KRW split 20,000 / 15,000 becomes 892.50 THB split by the same ratio.
    const thb = splitByWeights(89250n, { a: 20000n, b: 15000n })
    expect(thb).toEqual({ a: 51000n, b: 38250n })
    const odd = splitByWeights(100n, { a: 1n, b: 1n, c: 1n })
    expect(Object.values(odd).reduce((x, y) => x + y, 0n)).toBe(100n)
  })

  it('rejects empty or negative weights', () => {
    expect(() => splitByWeights(10n, { a: 0n })).toThrow(SplitError)
    expect(() => splitByWeights(10n, { a: 5n, b: -1n })).toThrow(SplitError)
  })
})
