import { describe, expect, it } from 'vitest'
import { pairTransfers, poolBalances, poolSettlement, summarizePool } from './pool'
import { type SplitExpense, splitEqual } from './split'

const POOL = 'pool'
const baht = (n: number) => BigInt(n) * 100n
const paid = (paidBy: string, amount: number, members: string[]): SplitExpense => ({
  paidBy,
  amount: baht(amount),
  shares: splitEqual(baht(amount), members),
})
const put = (userId: string, amount: number) => ({ userId, amount: baht(amount) })
const sum = (shares: Record<string, bigint>) => Object.values(shares).reduce((x, y) => x + y, 0n)

describe('pairTransfers: each person pays the people who paid for them', () => {
  it('case 1: two people, A pays dinner 1,000', () => {
    expect(pairTransfers([paid('a', 1000, ['a', 'b'])], POOL)).toEqual([
      { from: 'b', to: 'a', amount: baht(500), items: [{ index: 0, amount: baht(500) }] },
    ])
  })

  it('case 2: three people, A pays the hotel 3,000 and B dinner 1,500', () => {
    const transfers = pairTransfers(
      [paid('a', 3000, ['a', 'b', 'c']), paid('b', 1500, ['a', 'b', 'c'])],
      POOL,
    )
    expect(transfers.map((t) => [t.from, t.to, t.amount])).toEqual([
      ['c', 'a', baht(1000)],
      ['b', 'a', baht(500)],
      ['c', 'b', baht(500)],
    ])
    // B → A nets the hotel (+1,000) against the dinner B paid for A (−500).
    expect(transfers.find((t) => t.from === 'b')?.items).toEqual([
      { index: 0, amount: baht(1000) },
      { index: 1, amount: -baht(500) },
    ])
  })

  it('leaves pool-paid expenses out and drops pairs that even out', () => {
    expect(
      pairTransfers(
        [paid(POOL, 900, ['a', 'b']), paid('a', 200, ['b']), paid('b', 200, ['a'])],
        POOL,
      ),
    ).toEqual([])
  })
})

describe('poolSettlement: put in minus used', () => {
  it('case 3: both put in 2,000, spent 3,000 → 500 back each', () => {
    const s = poolSettlement([paid(POOL, 3000, ['a', 'b'])], {
      poolId: POOL,
      contributions: [put('a', 2000), put('b', 2000)],
    })
    expect(s).toEqual([
      { userId: 'a', contributed: baht(2000), used: baht(1500), net: baht(500) },
      { userId: 'b', contributed: baht(2000), used: baht(1500), net: baht(500) },
    ])
  })

  it('case 4: B put nothing in but used 600 → pays 600 in; A gets 2,400, C 400', () => {
    const s = poolSettlement([paid(POOL, 1800, ['a', 'b', 'c'])], {
      poolId: POOL,
      contributions: [put('a', 3000), put('c', 1000)],
    })
    expect(s.map((m) => [m.userId, m.net])).toEqual([
      ['a', baht(2400)],
      ['c', baht(400)],
      ['b', -baht(600)],
    ])
    // Left in the pool (2,200) = sum of the nets.
    expect(s.reduce((x, m) => x + m.net, 0n)).toBe(baht(2200))
  })

  it('never makes whoever put in more pay more: refunds are put in minus used', () => {
    const s = poolSettlement([paid(POOL, 1200, ['a', 'c'])], {
      poolId: POOL,
      contributions: [put('a', 3000), put('c', 1000)],
    })
    expect(s.map((m) => [m.userId, m.used, m.net])).toEqual([
      ['a', baht(600), baht(2400)],
      ['c', baht(600), baht(400)],
    ])
  })

  it('case 5: pool and a member-paid dinner are settled separately', () => {
    const expenses = [paid(POOL, 1800, ['a', 'b', 'c']), paid('b', 900, ['a', 'b', 'c'])]
    const contributions = [put('a', 3000), put('c', 1000)]
    expect(poolSettlement(expenses, { poolId: POOL, contributions }).map((m) => m.net)).toEqual([
      baht(2400),
      baht(400),
      -baht(600),
    ])
    expect(pairTransfers(expenses, POOL).map((t) => [t.from, t.to, t.amount])).toEqual([
      ['a', 'b', baht(300)],
      ['c', 'b', baht(300)],
    ])
    // Overall: A +2,100, B 0, C +100, and the pool hands back its 2,200.
    const overall = poolBalances(expenses, { poolId: POOL, contributions })
    expect(overall).toEqual({ a: baht(2100), b: 0n, c: baht(100), pool: -baht(2200) })
    expect(sum(overall)).toBe(0n)
  })
})

describe('summarizePool', () => {
  it('totals what went in, what was spent and each share in basis points', () => {
    const member: SplitExpense = { paidBy: 'a', amount: 500n, shares: { a: 500n } }
    expect(
      summarizePool(
        [paid(POOL, 10000, ['a', 'b']), member],
        [put('a', 7000), put('b', 5000)],
        POOL,
      ),
    ).toEqual({
      totalIn: baht(12000),
      spent: baht(10000),
      leftover: baht(2000),
      byMember: [
        { userId: 'a', contributed: baht(7000), percentBp: 5833 },
        { userId: 'b', contributed: baht(5000), percentBp: 4167 },
      ],
    })
  })

  it('copes with an empty pool', () => {
    expect(summarizePool([], [], POOL)).toEqual({
      totalIn: 0n,
      spent: 0n,
      leftover: 0n,
      byMember: [],
    })
  })
})
