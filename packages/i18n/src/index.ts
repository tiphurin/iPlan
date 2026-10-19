import { type Money, localDateKey, toDecimalString, zonedParts } from '@iplan/core'

export const LOCALES = ['th', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'th'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export type CalendarEra = 'buddhist' | 'gregory'

/** BCP 47 tag for Intl. Thai uses the Buddhist era (พ.ศ.) unless asked otherwise. */
export function intlLocale(locale: Locale, era: CalendarEra = 'buddhist'): string {
  if (locale === 'en') return 'en-GB'
  return era === 'buddhist' ? 'th-TH-u-ca-buddhist' : 'th-TH-u-ca-gregory'
}

export interface FormatOptions {
  locale: Locale
  era?: CalendarEra
}

/** 24-hour clock time in the item's zone: "14:30". */
export function formatTime(date: Date, timeZone: string, _options?: FormatOptions): string {
  const p = zonedParts(date, timeZone)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

// Dates are spelled out from our own tables instead of Intl: ICU data differs
// between Node versions and browsers ("ศ." vs "ศุกร์", "22–27" vs "22 – 27"),
// which breaks hydration and makes output machine-dependent.
const WEEKDAYS: Record<Locale, readonly string[]> = {
  th: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}
const MONTHS: Record<Locale, readonly string[]> = {
  th: [
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.',
  ],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

interface DateParts {
  year: number
  month: number
  day: number
  weekday: number
}

function parseDateKey(dateKey: string): DateParts {
  const date = new Date(`${dateKey}T12:00:00Z`)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
  }
}

/** Thai shows the Buddhist era (พ.ศ. = ค.ศ. + 543) unless asked otherwise. */
function displayYear(year: number, { locale, era = 'buddhist' }: FormatOptions): number {
  return locale === 'th' && era === 'buddhist' ? year + 543 : year
}

/** "ส. 17 ต.ค." / "Sat 17 Oct" for a trip day (YYYY-MM-DD). */
export function formatDayLabel(dateKey: string, { locale }: FormatOptions): string {
  const d = parseDateKey(dateKey)
  return `${WEEKDAYS[locale][d.weekday]} ${d.day} ${MONTHS[locale][d.month]}`
}

/** "17 ต.ค. 2569" / "17 Oct 2026". */
export function formatDate(dateKey: string, options: FormatOptions): string {
  const d = parseDateKey(dateKey)
  return `${d.day} ${MONTHS[options.locale][d.month]} ${displayYear(d.year, options)}`
}

/** "ต.ค. 2569" / "Oct 2026" for a "YYYY-MM" month. */
export function formatMonth(month: string, options: FormatOptions): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS[options.locale][(m ?? 1) - 1]} ${displayYear(y ?? 0, options)}`
}

/** "22–27 ต.ค. 2569", "30 ต.ค. – 2 พ.ย. 2569", or two full dates across years. */
export function formatDateRange(start: string, end: string, options: FormatOptions): string {
  const a = parseDateKey(start)
  const b = parseDateKey(end)
  const months = MONTHS[options.locale]
  const year = displayYear(b.year, options)
  if (a.year !== b.year) return `${formatDate(start, options)} – ${formatDate(end, options)}`
  if (a.month !== b.month)
    return `${a.day} ${months[a.month]} – ${b.day} ${months[b.month]} ${year}`
  if (a.day !== b.day) return `${a.day}–${b.day} ${months[a.month]} ${year}`
  return formatDate(start, options)
}

const SYMBOLS: Record<string, string> = {
  THB: '฿',
  KRW: '₩',
  JPY: '¥',
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  VND: '₫',
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * "฿1,500.25", "₩35,000", "SGD 12.00". Built by hand (not Intl) so Node and
 * every browser print the same text.
 */
export function formatMoney(value: Money, _options?: FormatOptions): string {
  const [whole = '0', fraction] = toDecimalString(value).replace('-', '').split('.')
  const symbol = SYMBOLS[value.currency]
  const amount = `${group(whole)}${fraction ? `.${fraction}` : ''}`
  const sign = value.amount < 0n ? '-' : ''
  return symbol ? `${sign}${symbol}${amount}` : `${sign}${value.currency} ${amount}`
}

/** Today's date key in a zone, for "is this trip happening today?" checks. */
export function todayKey(timeZone: string, now = new Date()): string {
  return localDateKey(now, timeZone)
}
