'use client'

import { durationParts } from '@iplan/core'
import { type Locale, formatDayLabel, formatTime } from '@iplan/i18n'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback } from 'react'

/** Locale-aware formatters for client components. */
export function useFormat() {
  const locale = useLocale() as Locale
  const t = useTranslations('duration')
  return {
    locale,
    time: useCallback(
      (iso: string | Date, zone: string) => formatTime(new Date(iso), zone, { locale }),
      [locale],
    ),
    day: useCallback((dateKey: string) => formatDayLabel(dateKey, { locale }), [locale]),
    /** "1 ชม. 15 นาที" style, for remaining time. */
    duration: useCallback(
      (ms: number) => {
        const p = durationParts(ms)
        if (p.days > 0) return t('dh', { d: p.days, h: p.hours })
        if (p.hours > 0) return t('hm', { h: p.hours, m: p.minutes })
        if (p.minutes > 0) return t('m', { m: p.minutes })
        return t('lessThanMinute')
      },
      [t],
    ),
    /** "2:05:09" style, for live countdowns. */
    clock: useCallback((ms: number) => {
      const p = durationParts(ms)
      const hours = p.days * 24 + p.hours
      const mm = String(p.minutes).padStart(2, '0')
      const ss = String(p.seconds).padStart(2, '0')
      return hours > 0 ? `${hours}:${mm}:${ss}` : `${p.minutes}:${ss}`
    }, []),
  }
}
