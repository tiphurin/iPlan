import { describe, expect, it } from 'vitest'
import { applyPoolMode, poolBalances, summarizePool } from './pool'
import { type SplitExpense, settle, splitEqual } from './split'

const POOL = 'pool'
const baht = (n: number) => BigInt(n) * 100n
const poolPaid = (amount: bigint, members = ['a', 'b']): SplitExpense => ({
  paidBy: POOL,
  amount,
  shares: splitEqual(amount, members),
})
/** A puts in ฿7,000, B ฿5,000. */
const contributions = [
  { userId: 'a', amount: baht(7000) },
  { userId: 'b', amount: baht(5000) },
]
const sum = (shares: Record<string, bigint>) => Object.values(shares).reduce((x, y) => x + y, 0n)

describe('poolBalances, actual mode', () => {
  it('refunds whoever put in more than they used (7,000 / 5,000, spent 10,000 equally)', () => {
    const balances = poolBalances([poolPaid(baht(10000))], {
      poolId: POOL,
      mode: 'actual',
      contributions,
    })
    expect(balances).toEqual({ a: baht(2000), b: 0n, pool: -baht(2000) })
    expect(settle(balances)).toEqual([{ from: POOL, to: 'a', amount: baht(2000) }])
  })

  it('puts a shortfall on members through their own shares', () => {
    const balances = poolBalances([poolPaid(baht(14000))], {
      poolId: POOL,
      mode: 'actual',
      contributions,
    })
    // Each used 7,000: A is even, B owes 2,000 to the pool.
    expect(balances).toEqual({ a: 0n, b: -baht(2000), pool: baht(2000) })
    expect(settle(balances)).toEqual([{ from: 'b', to: POOL, amount: baht(2000) }])
  })

  it('works with no contributions (pool is owed what it paid)', () => {
    const balances = poolBalances([poolPaid(baht(100))], {
      poolId: POOL,
      mode: 'actual',
      contributions: [],
    })
    expect(balances).toEqual({ a: -baht(50), b: -baht(50), pool: baht(100) })
  })

  it('mixes with member-paid expenses', () => {
    const member: SplitExpense = {
      paidBy: 'b',
      amount: baht(600),
      shares: splitEqual(baht(600), ['a', 'b']),
    }
    const balances = poolBalances([poolPaid(baht(10000)), member], {
      poolId: POOL,
      mode: 'actual',
      contributions,
    })
    expect(balances).toEqual({ a: baht(1700), b: baht(300), pool: -baht(2000) })
    expect(sum(balances)).toBe(0n)
  })
})

describe('poolBalances, proportional mode', () => {
  it('shares spending and the leftover by what each put in', () => {
    const balances = poolBalances([poolPaid(baht(10000))], {
      poolId: POOL,
      mode: 'proportional',
      contributions,
    })
    // A: 7/12 of 10,000 = 5,833.33 → gets 1,166.67 back; B: 4,166.67 → 833.33 back.
    expect(balances).toEqual({ a: 116_667n, b: 83_333n, pool: -baht(2000) })
    const transfers = settle(balances)
    expect(transfers).toEqual([
      { from: POOL, to: 'a', amount: 116_667n },
      { from: POOL, to: 'b', amount: 83_333n },
    ])
  })

  it('shares a shortfall in the same proportion', () => {
    const balances = poolBalances([poolPaid(baht(15000))], {
      poolId: POOL,
      mode: 'proportional',
      contributions,
    })
    expect(balances).toEqual({ a: -baht(1750), b: -baht(1250), pool: baht(3000) })
  })

  it('falls back to each expense split when nobody has put money in', () => {
    const expenses = [poolPaid(baht(90), ['a', 'b', 'c'])]
    expect(
      applyPoolMode(expenses, { poolId: POOL, mode: 'proportional', contributions: [] }),
    ).toEqual(expenses)
  })

  it('rounds to the satang and still adds up, leaving member-paid expenses alone', () => {
    const member: SplitExpense = {
      paidBy: 'a',
      amount: 1001n,
      shares: splitEqual(1001n, ['a', 'c']),
    }
    const applied = applyPoolMode([poolPaid(1001n, ['a', 'b', 'c']), member], {
      poolId: POOL,
      mode: 'proportional',
      contributions: [
        { userId: 'a', amount: 100n },
        { userId: 'b', amount: 100n },
        { userId: 'c', amount: 100n },
      ],
    })
    expect(applied[0]?.shares).toEqual({ a: 334n, b: 334n, c: 333n })
    expect(applied[1]).toBe(member)
  })

  it('adds up contributions per member, including ones already converted from other currencies', () => {
    // ₩100,000 at 0.0255 = ฿2,550 plus ฿1,450 from A; ฿4,000 from B: 50/50.
    const balances = poolBalances([poolPaid(baht(6000))], {
      poolId: POOL,
      mode: 'proportional',
      contributions: [
        { userId: 'a', amount: 255_000n },
        { userId: 'b', amount: baht(4000) },
        { userId: 'a', amount: 145_000n },
      ],
    })
    expect(balances).toEqual({ a: baht(1000), b: baht(1000), pool: -baht(2000) })
  })
})

describe('summarizePool', () => {
  it('totals what went in, what was spent and each share in basis points', () => {
    const member: SplitExpense = { paidBy: 'a', amount: 500n, shares: { a: 500n } }
    expect(summarizePool([poolPaid(baht(10000)), member], contributions, POOL)).toEqual({
      totalIn: baht(12000),
      spent: baht(10000),
      leftover: baht(2000),
      byMember: [
        { userId: 'a', contributed: baht(7000), percentBp: 5833 },
        { userId: 'b', contributed: baht(5000), percentBp: 4167 },
      ],
    })
  })

  it('reports a shortfall as a negative leftover and copes with an empty pool', () => {
    expect(summarizePool([poolPaid(baht(100))], [], POOL)).toEqual({
      totalIn: 0n,
      spent: baht(100),
      leftover: -baht(100),
      byMember: [],
    })
  })
})
