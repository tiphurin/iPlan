import { money } from '@iplan/core'
import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateRange,
  formatDayLabel,
  formatMoney,
  formatTime,
  intlLocale,
  resolveLocale,
} from './index'

const th = { locale: 'th' as const }
const en = { locale: 'en' as const }

describe('locales', () => {
  it('falls back to Thai', () => {
    expect(resolveLocale('en')).toBe('en')
    expect(resolveLocale('fr')).toBe('th')
    expect(resolveLocale(undefined)).toBe('th')
    expect(intlLocale('th', 'gregory')).toBe('th-TH-u-ca-gregory')
  })
})

describe('formatters', () => {
  const departure = new Date('2026-10-22T19:25:00Z')

  it('shows 24-hour time in the item zone', () => {
    expect(formatTime(departure, 'Asia/Bangkok', en)).toBe('02:25')
    expect(formatTime(departure, 'Asia/Seoul', th)).toBe('04:25')
  })

  it('uses the Buddhist era in Thai by default', () => {
    expect(formatDate('2026-10-23', th)).toContain('2569')
    expect(formatDate('2026-10-23', { locale: 'th', era: 'gregory' })).toContain('2026')
    expect(formatDate('2026-10-23', en)).toBe('23 Oct 2026')
  })

  it('labels trip days and ranges', () => {
    expect(formatDayLabel('2026-10-23', en)).toBe('Fri 23 Oct')
    expect(formatDayLabel('2026-10-23', th)).toBe('ศ. 23 ต.ค.')
    expect(formatDayLabel('2027-01-03', th)).toBe('อา. 3 ม.ค.')
    expect(formatDateRange('2026-10-22', '2026-10-27', en)).toBe('22–27 Oct 2026')
  })

  it('formats money per locale', () => {
    expect(formatMoney(money(150025n, 'THB'), en)).toBe('THB 1,500.25')
    expect(formatMoney(money(150025n, 'THB'), th)).toBe('฿1,500.25')
  })
})
