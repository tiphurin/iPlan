import { type Money, formatMoney as formatMoneyCore, localDateKey } from '@iplan/core'

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
export function formatTime(date: Date, timeZone: string, { locale, era }: FormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale, era), {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function dateKeyToUtcNoon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`)
}

/** "ส. 17 ต.ค." / "Sat 17 Oct" for a trip day (YYYY-MM-DD). */
export function formatDayLabel(dateKey: string, { locale, era }: FormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale, era), {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dateKeyToUtcNoon(dateKey))
}

/** "17 ต.ค. 2569" / "17 Oct 2026". */
export function formatDate(dateKey: string, { locale, era }: FormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale, era), {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dateKeyToUtcNoon(dateKey))
}

/** "17–21 ต.ค. 2569" style range for trip cards. */
export function formatDateRange(
  start: string,
  end: string,
  { locale, era }: FormatOptions,
): string {
  return new Intl.DateTimeFormat(intlLocale(locale, era), {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatRange(dateKeyToUtcNoon(start), dateKeyToUtcNoon(end))
}

export function formatMoney(value: Money, { locale }: FormatOptions): string {
  return formatMoneyCore(value, locale === 'th' ? 'th-TH' : 'en-GB')
}

/** Today's date key in a zone, for "is this trip happening today?" checks. */
export function todayKey(timeZone: string, now = new Date()): string {
  return localDateKey(now, timeZone)
}
