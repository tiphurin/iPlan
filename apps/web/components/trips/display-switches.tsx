'use client'

import type { TripDetailDto } from '@iplan/contracts'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { useTripDisplay } from '@/lib/trip-display'
import { zoneCurrency, zoneShort } from '@/lib/time-zones'
import { useFormat } from '@/lib/use-format'

const SYMBOL: Record<string, string> = { THB: '฿', KRW: '₩', JPY: '¥', USD: '$', EUR: '€' }

/**
 * Live clocks that double as the time switch (tap the zone the plan should use)
 * and a labelled currency switch. Shown under the trip bar, not stuck to it.
 */
export function DisplaySwitches({
  trip,
  away,
  serverNow,
}: {
  trip: TripDetailDto
  away: string
  serverNow: number
}) {
  const t = useTranslations('tripView')
  const f = useFormat()
  const { display, setDisplay } = useTripDisplay()
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 30_000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [])
  const local = zoneCurrency(away)
  const hasMoney =
    local !== undefined && local !== trip.baseCurrency && Boolean(trip.fxRates[local])
  const option = (on: boolean) =>
    cn(
      'flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm transition-colors',
      on ? 'seg-on font-semibold' : 'text-muted-foreground',
    )

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-faint">{t('timeMode')}</span>
        <div
          role="radiogroup"
          aria-label={t('timeMode')}
          className="flex rounded-full border bg-card p-0.5"
        >
          {(
            [
              ['local', away],
              ['home', trip.homeTimeZone],
            ] as const
          ).map(([mode, zone]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={display.time === mode}
              onClick={() => setDisplay({ time: mode })}
              className={option(display.time === mode)}
            >
              <span className="text-xs opacity-80">{zoneShort(zone)}</span>
              <span className="num" suppressHydrationWarning>
                {f.time(new Date(now), zone)}
              </span>
            </button>
          ))}
        </div>
      </div>
      {hasMoney && local && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-faint">{t('moneyMode')}</span>
          <div
            role="radiogroup"
            aria-label={t('moneyMode')}
            className="flex rounded-full border bg-card p-0.5"
          >
            {(
              [
                ['local', local],
                ['base', trip.baseCurrency],
              ] as const
            ).map(([mode, code]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={display.money === mode}
                onClick={() => setDisplay({ money: mode })}
                className={option(display.money === mode)}
              >
                <span className="font-display">{SYMBOL[code] ?? ''}</span>
                {t(`currency.${code}`, { code })}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
