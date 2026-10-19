'use client'

import type { ExpenseDto, TripDetailDto, TripItemDto } from '@iplan/contracts'
import { currentTripDay } from '@iplan/core'
import { formatDateRange, todayKey } from '@iplan/i18n'
import { CalendarDays } from 'lucide-react'
import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Fab } from '@/components/ui/fab'
import { MonthCalendar } from '@/components/ui/month-calendar'
import { Sheet } from '@/components/ui/sheet'
import { cn } from '@/lib/cn'
import { dayColor } from '@/lib/day-colors'
import { useExpenses } from '@/lib/expenses'
import { awayZone } from '@/lib/time-zones'
import { TripDisplayProvider } from '@/lib/trip-display'
import { tripDays } from '@/lib/trip-dates'
import { useItems, useTrip } from '@/lib/trips'
import { useFormat } from '@/lib/use-format'
import { ItemSheet } from './item-sheet'
import { Timeline } from './timeline'
import { TripTopBar } from './trip-top-bar'
import { DisplaySwitches } from './display-switches'

export function TripView({
  initialTrip,
  initialItems,
  initialExpenses,
  meId,
  serverNow,
}: {
  initialTrip: TripDetailDto
  initialItems: TripItemDto[]
  initialExpenses: ExpenseDto[]
  meId: string
  serverNow: number
}) {
  const t = useTranslations()
  const f = useFormat()
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const { data: trip } = useTrip(initialTrip.id, initialTrip)
  const { data: items } = useItems(initialTrip.id, initialItems)
  const { data: expenses } = useExpenses(initialTrip.id, initialExpenses)
  const away = awayZone(items, trip.homeTimeZone)
  /** Spending linked to each plan item, in the trip's base currency. */
  const spentByItem = useMemo(() => {
    const map = new Map<string, bigint>()
    for (const e of expenses) {
      if (e.itemId) map.set(e.itemId, (map.get(e.itemId) ?? 0n) + BigInt(e.baseAmountMinor))
    }
    return map
  }, [expenses])
  const days = useMemo(() => tripDays(trip.startDate, trip.endDate), [trip.startDate, trip.endDate])
  const canEdit = trip.role !== 'viewer'

  const fallbackDay = useMemo(() => {
    const live = currentTripDay(
      items.map((i) => ({ dayDate: i.dayDate, startsAt: new Date(i.startsAt) })),
      new Date(),
    )
    return live && days.includes(live) ? live : days[0]
  }, [items, days])
  const requested = search.get('day')
  const focusId = search.get('focus')
  const day = requested && days.includes(requested) ? requested : (fallbackDay ?? trip.startDate)
  const dayIndex = days.indexOf(day)
  const dayItems = items.filter((i) => i.dayDate === day)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  // The calendar follows the selected day until the user flips months.
  const [shown, setShown] = useState({ day, month: day.slice(0, 7) })
  const month = shown.day === day ? shown.month : day.slice(0, 7)
  const setMonth = (m: string) => setShown({ day, month: m })

  const selectDay = (d: string) => {
    setCalendarOpen(false)
    router.replace(`${pathname}?day=${d}` as Route, { scroll: false })
  }

  // Keep the selected day chip in view.
  const selectedRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [day])

  const marks = useMemo(() => {
    const out: Record<string, { dots: string[] }> = {}
    days.forEach((d, i) => {
      if (items.some((item) => item.dayDate === d)) out[d] = { dots: [dayColor(i)] }
    })
    return out
  }, [days, items])

  const calendar = (
    <MonthCalendar
      month={month}
      onMonthChange={setMonth}
      selected={day}
      onSelect={selectDay}
      today={todayKey(trip.homeTimeZone)}
      range={{ start: trip.startDate, end: trip.endDate }}
      marks={marks}
      isEnabled={(d) => days.includes(d)}
    />
  )

  const dayStrip = (
    <div className="pb-2">
      <div className="flex items-center gap-2 px-4">
        <nav
          aria-label={t('item.day')}
          className="scrollbar-none flex flex-1 snap-x gap-1.5 overflow-x-auto"
        >
          {days.map((d, index) => {
            const on = d === day
            return (
              <button
                key={d}
                ref={on ? selectedRef : undefined}
                type="button"
                onClick={() => selectDay(d)}
                aria-pressed={on}
                className="min-w-[66px] shrink-0 snap-center rounded-xl border px-3 py-2 text-center"
                style={
                  on
                    ? {
                        backgroundColor: dayColor(index),
                        borderColor: dayColor(index),
                        color: '#fff',
                      }
                    : { backgroundColor: 'var(--card)' }
                }
              >
                <b className="block font-display text-[17px] leading-tight">
                  {t('trips.dayShort', { n: index + 1 })}
                </b>
                <span className={cn('text-xs', !on && 'text-muted-foreground')}>{f.day(d)}</span>
              </button>
            )
          })}
        </nav>
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          aria-label={t('calendar.open')}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-card md:hidden"
        >
          <CalendarDays aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  )

  return (
    <TripDisplayProvider tripId={trip.id}>
      <TripTopBar trip={trip} view="plan" day={day} below={dayStrip} />
      <div className="px-4 pt-3 pb-2">
        <p className="text-sm text-muted-foreground">
          {formatDateRange(trip.startDate, trip.endDate, { locale: f.locale })}
          {trip.destination && ` · ${trip.destination}`}
        </p>
        {away && (
          <div className="mt-3">
            <DisplaySwitches trip={trip} away={away} serverNow={serverNow} />
          </div>
        )}
      </div>

      <div className="md:grid md:grid-cols-[320px_minmax(0,1fr)] md:items-start md:gap-6 md:px-4">
        <aside className="hidden md:sticky md:top-56 md:block">{calendar}</aside>

        <div className="min-w-0">
          <div className="px-4 md:px-0">
            <h2 className="mt-2 mb-1 text-2xl font-bold">
              {t('trips.dayN', { n: dayIndex + 1 })} · {f.day(day)}
            </h2>
            <p className="mb-2 text-sm text-muted-foreground">
              {t('trips.itemCount', { count: dayItems.length })}
            </p>
            {dayItems.length === 0 ? (
              <Card className="text-center text-muted-foreground">{t('trips.noItems')}</Card>
            ) : (
              <Timeline
                items={dayItems}
                tripId={trip.id}
                homeTimeZone={trip.homeTimeZone}
                color={dayColor(dayIndex)}
                meId={meId}
                spent={{ byItem: spentByItem, currency: trip.baseCurrency, rates: trip.fxRates }}
                focusId={focusId}
                onOpen={(item) => setOpenItemId(item.id)}
              />
            )}
          </div>
        </div>
      </div>

      <Sheet open={calendarOpen} onClose={() => setCalendarOpen(false)} title={t('calendar.title')}>
        {calendar}
      </Sheet>

      <ItemSheet
        item={items.find((i) => i.id === openItemId) ?? null}
        trip={trip}
        spent={{ byItem: spentByItem, currency: trip.baseCurrency, rates: trip.fxRates }}
        onClose={() => setOpenItemId(null)}
      />

      {canEdit && <Fab href={`/trips/${trip.id}/items/new?day=${day}`} label={t('common.add')} />}
    </TripDisplayProvider>
  )
}
