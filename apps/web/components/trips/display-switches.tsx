'use client'

import type { TripDetailDto } from '@iplan/contracts'
import { Banknote, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { useTripDisplay } from '@/lib/trip-display'
import { zoneCurrency, zoneShort } from '@/lib/time-zones'
import { useFormat } from '@/lib/use-format'

const SYMBOL: Record<string, string> = { THB: '฿', KRW: '₩', JPY: '¥', USD: '$', EUR: '€' }
const TRACK = 'inline-flex items-center gap-0.5 rounded-full bg-muted p-1'
const option = (on: boolean) =>
  cn(
    'flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm transition-colors',
    on ? 'seg-on font-semibold' : 'text-muted-foreground',
  )

/**
 * Two compact switches: live clocks that pick which zone the plan shows, and
 * the currency for amounts. The chosen side is a raised pill on a grey track.
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label={t('timeMode')} className={TRACK}>
        <Clock aria-hidden className="mx-1.5 size-4 text-faint" />
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
            <span className="text-[11px] font-semibold tracking-wide opacity-70">
              {zoneShort(zone)}
            </span>
            <span className="num" suppressHydrationWarning>
              {f.time(new Date(now), zone)}
            </span>
          </button>
        ))}
      </div>
      {hasMoney && local && <MoneySwitch trip={trip} local={local} />}
    </div>
  )
}

/** "₩ KRW | ฿ THB": the currency trip amounts are shown in (shared by the plan and the costs). */
export function MoneySwitch({ trip, local }: { trip: TripDetailDto; local: string }) {
  const t = useTranslations('tripView')
  const { display, setDisplay } = useTripDisplay()
  return (
    <div role="radiogroup" aria-label={t('moneyMode')} className={TRACK}>
      <Banknote aria-hidden className="mx-1.5 size-4 text-faint" />
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
          aria-label={t(`currency.${code}`, { code })}
          onClick={() => setDisplay({ money: mode })}
          className={option(display.money === mode)}
        >
          <span className="font-display">{SYMBOL[code] ?? ''}</span>
          {code}
        </button>
      ))}
    </div>
  )
}
