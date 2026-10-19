import { describe, expect, it } from 'vitest'
import {
  balanceRows,
  chartMax,
  dayBars,
  personBars,
  settleHeadline,
  viewerShare,
} from './expense-charts'

describe('dayBars', () => {
  it('flags days over budget and labels the month on the first day and the 1st', () => {
    const bars = dayBars([
      { dayDate: '2026-10-30', spentMinor: '250000', budgetMinor: '300000' },
      { dayDate: '2026-10-31', spentMinor: '350000', budgetMinor: '300000' },
      { dayDate: '2026-11-01', spentMinor: '0', budgetMinor: '300000' },
      { dayDate: '2026-11-02', spentMinor: '300000', budgetMinor: '300000' },
    ])
    expect(bars.map((b) => b.label)).toEqual(['30/10', '31', '1/11', '2'])
    expect(bars.map((b) => b.over)).toEqual([false, true, false, false])
    expect(bars[0]).toMatchObject({ key: '2026-10-30', spent: 250000, budget: 300000 })
  })

  it('never flags a day when there is no budget', () => {
    const [bar] = dayBars([{ dayDate: '2026-10-22', spentMinor: '999', budgetMinor: null }])
    expect(bar).toMatchObject({ budget: null, over: false })
  })
})

describe('personBars', () => {
  const party = (id: string, name: string, paid: string, share: string, net: string) => ({
    id,
    name,
    paidMinor: paid,
    shareMinor: share,
    netMinor: net,
  })

  it('sorts by share, drops idle parties and keeps a pool that paid', () => {
    const bars = personBars([
      party('a', 'Ann', '100', '300', '-200'),
      party('pool', 'Pool', '200', '0', '200'),
      party('b', 'Ben', '400', '400', '0'),
      party('c', 'Cat', '0', '0', '0'),
    ])
    expect(bars.map((b) => b.id)).toEqual(['b', 'a', 'pool'])
    expect(bars[2]).toMatchObject({ isPool: true, paid: 200, share: 0, net: 200 })
    expect(bars[1]).toMatchObject({ net: -200 })
  })
})

describe('viewerShare', () => {
  const parties = [{ id: 'u1', name: 'Me', paidMinor: '0', shareMinor: '1500', netMinor: '-1500' }]
  it('finds the viewer', () => expect(viewerShare(parties, 'u1')).toBe('1500'))
  it('returns null for outsiders or no session', () => {
    expect(viewerShare(parties, 'u2')).toBeNull()
    expect(viewerShare(parties, null)).toBeNull()
  })
})

describe('chartMax', () => {
  it('ignores nulls and never returns below 1', () => {
    expect(chartMax([])).toBe(1)
    expect(chartMax([null, 5, 3])).toBe(5)
  })
})

describe('balanceRows', () => {
  it('puts those owed money first and drops idle parties', () => {
    const rows = balanceRows([
      { id: 'a', name: 'Ann', paidMinor: '100', shareMinor: '300', netMinor: '-200' },
      { id: 'pool', name: 'Pool', paidMinor: '50', shareMinor: '0', netMinor: '50' },
      { id: 'b', name: 'Ben', paidMinor: '450', shareMinor: '300', netMinor: '150' },
      { id: 'c', name: 'Cat', paidMinor: '0', shareMinor: '0', netMinor: '0' },
    ])
    expect(rows.map((r) => [r.id, r.net])).toEqual([
      ['b', 150],
      ['pool', 50],
      ['a', -200],
    ])
    expect(rows[1]?.isPool).toBe(true)
  })
})

describe('settleHeadline', () => {
  const tr = (from: string, to: string, amountMinor: string) => ({
    from,
    fromName: from,
    to,
    toName: to,
    amountMinor,
  })
  it('says settled when nothing is owed', () => {
    expect(settleHeadline([])).toEqual({ kind: 'settled' })
  })
  it('names the one transfer', () => {
    expect(settleHeadline([tr('a', 'b', '450000')])).toEqual({
      kind: 'single',
      transfer: tr('a', 'b', '450000'),
    })
  })
  it('counts and totals several transfers', () => {
    expect(settleHeadline([tr('a', 'b', '100'), tr('c', 'b', '250')])).toEqual({
      kind: 'many',
      count: 2,
      totalMinor: '350',
    })
  })
})
