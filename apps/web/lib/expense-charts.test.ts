import { describe, expect, it } from 'vitest'
import {
  chartMax,
  dayBars,
  personBars,
  poolHeadline,
  settleCards,
  settleCount,
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

describe('settleCards', () => {
  const party = (id: string, netMinor = '0') => ({
    id,
    name: id.toUpperCase(),
    paidMinor: '0',
    shareMinor: '0',
    contributedMinor: '0',
    netMinor,
  })
  const tr = (
    from: string,
    to: string,
    amountMinor: string,
    items = [{ title: 'Hotel', amountMinor }],
  ) => ({
    from,
    fromName: from.toUpperCase(),
    to,
    toName: to.toUpperCase(),
    amountMinor,
    items: items.map((i) => ({ expenseId: '00000000-0000-4000-8000-000000000001', ...i })),
  })
  const pool = (userId: string, contributedMinor: string, usedMinor: string) => ({
    userId,
    name: userId.toUpperCase(),
    contributedMinor,
    usedMinor,
    netMinor: (BigInt(contributedMinor) - BigInt(usedMinor)).toString(),
  })

  it('case 5: pool and person lines on each card, viewer first', () => {
    const summary = {
      parties: [party('a'), party('b'), party('c')],
      transfers: [
        tr('a', 'b', '30000', [{ title: 'Dinner', amountMinor: '30000' }]),
        tr('c', 'b', '30000'),
      ],
      pool: [pool('a', '300000', '60000'), pool('c', '100000', '60000'), pool('b', '0', '60000')],
    }
    const cards = settleCards(summary, 'b')
    expect(cards.map((c) => [c.id, c.netMinor])).toEqual([
      ['b', '0'],
      ['c', '10000'],
      ['a', '210000'],
    ])
    const b = cards[0]
    expect(b?.pay).toMatchObject([
      { kind: 'pool', amountMinor: '60000', contributedMinor: '0', usedMinor: '60000' },
    ])
    expect(b?.get.map((l) => [l.kind, l.id, l.amountMinor])).toEqual([
      ['person', 'a', '30000'],
      ['person', 'c', '30000'],
    ])
    expect(cards[2]?.get[0]).toMatchObject({ kind: 'pool', amountMinor: '240000' })
    expect(cards[2]?.pay[0]).toMatchObject({
      kind: 'person',
      id: 'b',
      items: [{ title: 'Dinner' }],
    })
    expect(settleCount(summary)).toBe(5)
  })

  it('shows the viewer even with nothing to do, and counts zero when settled', () => {
    const summary = { parties: [party('a')], transfers: [], pool: [pool('a', '1000', '1000')] }
    expect(settleCards(summary, 'a')).toEqual([
      { id: 'a', name: 'A', netMinor: '0', pay: [], get: [] },
    ])
    expect(settleCount(summary)).toBe(0)
  })
})

describe('personBars with the pool', () => {
  it('keeps members who only put money into the pool', () => {
    const bars = personBars([
      {
        id: 'a',
        name: 'Ann',
        paidMinor: '0',
        shareMinor: '0',
        contributedMinor: '500',
        netMinor: '500',
      },
      {
        id: 'pool',
        name: 'Pool',
        paidMinor: '0',
        shareMinor: '0',
        contributedMinor: '0',
        netMinor: '-500',
      },
    ])
    expect(bars.map((b) => [b.id, b.contributed, b.net])).toEqual([
      ['a', 500, 500],
      ['pool', 0, -500],
    ])
  })
})

describe('poolHeadline', () => {
  const m = (userId: string, contributedBaseMinor: string) => ({
    userId,
    name: userId.toUpperCase(),
    contributedBaseMinor,
    percentBp: 0,
  })
  it('handles an empty pool, one person and equal amounts', () => {
    expect(poolHeadline([])).toEqual({ kind: 'empty' })
    expect(poolHeadline([m('a', '100')])).toEqual({ kind: 'only', userId: 'a', name: 'A' })
    expect(poolHeadline([m('a', '100'), m('b', '100')])).toEqual({ kind: 'equal' })
  })
  it('says who put in more and by how much', () => {
    expect(poolHeadline([m('b', '500000'), m('a', '700000')])).toEqual({
      kind: 'more',
      top: { userId: 'a', name: 'A' },
      other: { userId: 'b', name: 'B' },
      diffMinor: '200000',
      most: false,
    })
    expect(poolHeadline([m('a', '300'), m('b', '200'), m('c', '100')])).toMatchObject({
      top: { userId: 'a' },
      other: { userId: 'b' },
      diffMinor: '100',
      most: true,
    })
    // Tied at the top: compare with the smallest.
    expect(poolHeadline([m('a', '300'), m('b', '300'), m('c', '100')])).toMatchObject({
      other: { userId: 'c' },
      diffMinor: '200',
      most: false,
    })
  })
})
