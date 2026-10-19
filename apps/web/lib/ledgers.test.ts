import { describe, expect, it } from 'vitest'
import {
  defaultWalletMonth,
  entryMonth,
  groupByDay,
  newEntryDate,
  parseWalletTab,
  pickWalletMonth,
  stepWalletMonth,
  validDateKey,
  walletMonths,
} from './ledgers'

describe('parseWalletTab', () => {
  it('accepts months, falls back to overview', () => {
    expect(parseWalletTab('months')).toBe('months')
    expect(parseWalletTab('overview')).toBe('overview')
    expect(parseWalletTab('x')).toBe('overview')
    expect(parseWalletTab(undefined)).toBe('overview')
  })
})

describe('validDateKey', () => {
  it('accepts real dates only', () => {
    expect(validDateKey('2026-10-19')).toBe('2026-10-19')
    expect(validDateKey('2026-02-30')).toBeNull()
    expect(validDateKey('2026-13-01')).toBeNull()
    expect(validDateKey('19/10/2026')).toBeNull()
    expect(validDateKey(['2026-10-19'])).toBeNull()
  })
})

describe('entryMonth', () => {
  const byId = new Map([['e1', { date: '2026-09-28' }]])
  it('uses the date for expenses', () => {
    expect(entryMonth({ date: '2026-10-03', settlesMonth: null, settlesEntryId: null }, byId)).toBe(
      '2026-10',
    )
  })
  it('uses the settled month or expense for settlements', () => {
    expect(
      entryMonth({ date: '2026-11-01', settlesMonth: '2026-10', settlesEntryId: null }, byId),
    ).toBe('2026-10')
    expect(entryMonth({ date: '2026-11-01', settlesMonth: null, settlesEntryId: 'e1' }, byId)).toBe(
      '2026-09',
    )
    expect(
      entryMonth({ date: '2026-11-01', settlesMonth: null, settlesEntryId: 'gone' }, byId),
    ).toBe('2026-11')
  })
})

describe('wallet months', () => {
  it('lists months with data plus the current one, oldest first', () => {
    expect(walletMonths(['2026-09', '2026-07'], '2026-10')).toEqual([
      '2026-07',
      '2026-09',
      '2026-10',
    ])
    expect(walletMonths(['2026-10', '2026-09'], '2026-10')).toEqual(['2026-09', '2026-10'])
    expect(walletMonths([], '2026-10')).toEqual(['2026-10'])
  })
  it('defaults to the current month when it has data, else the latest', () => {
    expect(defaultWalletMonth(['2026-09', '2026-10'], '2026-10')).toBe('2026-10')
    expect(defaultWalletMonth(['2026-07', '2026-09'], '2026-10')).toBe('2026-09')
    expect(defaultWalletMonth([], '2026-10')).toBe('2026-10')
  })
  it('keeps a month from the URL only when it is in the list', () => {
    expect(pickWalletMonth('2026-07', ['2026-07', '2026-09'], '2026-10')).toBe('2026-07')
    expect(pickWalletMonth('2026-10', ['2026-07', '2026-09'], '2026-10')).toBe('2026-10')
    expect(pickWalletMonth('2026-08', ['2026-07', '2026-09'], '2026-10')).toBe('2026-09')
    expect(pickWalletMonth(undefined, [], '2026-10')).toBe('2026-10')
  })
  it('steps to neighbours and stops at the ends', () => {
    const months = ['2026-07', '2026-09', '2026-10']
    expect(stepWalletMonth(months, '2026-09', -1)).toBe('2026-07')
    expect(stepWalletMonth(months, '2026-09', 1)).toBe('2026-10')
    expect(stepWalletMonth(months, '2026-07', -1)).toBeNull()
    expect(stepWalletMonth(months, '2026-10', 1)).toBeNull()
    expect(stepWalletMonth(months, '2026-08', 1)).toBeNull()
  })
})

describe('groupByDay', () => {
  it('groups newest day first and newest entry first within a day', () => {
    const e = (id: string, date: string, createdAt: string) => ({ id, date, createdAt })
    const days = groupByDay([
      e('a', '2026-10-03', '2026-10-03T01:00:00.000Z'),
      e('b', '2026-10-10', '2026-10-10T01:00:00.000Z'),
      e('c', '2026-10-03', '2026-10-03T05:00:00.000Z'),
    ])
    expect(days.map((d) => [d.date, d.entries.map((x) => x.id)])).toEqual([
      ['2026-10-10', ['b']],
      ['2026-10-03', ['c', 'a']],
    ])
    expect(groupByDay([])).toEqual([])
  })
})

describe('newEntryDate', () => {
  it('uses today in the current month, else the first of the month', () => {
    expect(newEntryDate('2026-10', '2026-10-19')).toBe('2026-10-19')
    expect(newEntryDate('2026-09', '2026-10-19')).toBe('2026-09-01')
  })
})
