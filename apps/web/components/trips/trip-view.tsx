'use client'

import type { TripDetailDto, TripItemDto } from '@iplan/contracts'
import { currentTripDay } from '@iplan/core'
import { formatDateRange, todayKey } from '@iplan/i18n'
import { CalendarDays, ClipboardList, Clock, Info, Pencil, Users, Wallet } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BackLink } from '@/components/back-link'
import { buttonVariants } from '@/components/ui/button'
import { Card, ListGroup } from '@/components/ui/card'
import { Fab } from '@/components/ui/fab'
import { ListRow } from '@/components/ui/list-row'
import { MonthCalendar } from '@/components/ui/month-calendar'
import { Sheet } from '@/components/ui/sheet'
import { cn } from '@/lib/cn'
import { dayColor } from '@/lib/day-colors'
import { tripDays } from '@/lib/trip-dates'
import { useItems, useTrip } from '@/lib/trips'
import { useFormat } from '@/lib/use-format'
import { Timeline } from './timeline'

export function TripView({
  initialTrip,
  initialItems,
  meId,
}: {
  initialTrip: TripDetailDto
  initialItems: TripItemDto[]
  meId: string
}) {
  const t = useTranslations()
  const f = useFormat()
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const { data: trip } = useTrip(initialTrip.id, initialTrip)
  const { data: items } = useItems(initialTrip.id, initialItems)
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
  const day = requested && days.includes(requested) ? requested : (fallbackDay ?? trip.startDate)
  const dayIndex = days.indexOf(day)
  const dayItems = items.filter((i) => i.dayDate === day)
  const [calendarOpen, setCalendarOpen] = useState(false)
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

  const sections = [
    { path: 'today', icon: Clock, label: t('trips.openToday'), color: 'text-l2' },
    { path: 'expenses', icon: Wallet, label: t('trips.expenses'), color: 'text-l1' },
    { path: 'checklist', icon: ClipboardList, label: t('trips.checklist'), color: 'text-l3' },
    { path: 'info', icon: Info, label: t('trips.info'), color: 'text-la' },
    {
      path: 'members',
      icon: Users,
      label: t('trips.members', { count: trip.members.length }),
      color: 'text-l5',
    },
  ] as const

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

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-6">
        <BackLink href="/trips" label={t('nav.trips')} />
        {canEdit && (
          <Link
            href={`/trips/${trip.id}/edit` as Route}
            aria-label={t('trips.editTrip')}
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          >
            <Pencil aria-hidden className="size-5" />
          </Link>
        )}
      </div>
      <header className="px-4 pb-3">
        <h1 className="text-[28px] leading-tight font-bold md:text-4xl">{trip.name}</h1>
        <p className="text-muted-foreground">
          {formatDateRange(trip.startDate, trip.endDate, { locale: f.locale })}
          {trip.destination && ` · ${trip.destination}`}
        </p>
        <nav className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:hidden">
          {sections.map(({ path, icon: Icon, label, color }) => (
            <Link
              key={path}
              href={`/trips/${trip.id}/${path}` as Route}
              className={cn(buttonVariants({ variant: 'secondary' }), 'shrink-0')}
            >
              <Icon aria-hidden className={cn('size-4', color)} />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="md:grid md:grid-cols-[320px_minmax(0,1fr)] md:items-start md:gap-6 md:px-4">
        <aside className="hidden space-y-4 md:sticky md:top-4 md:block">
          {calendar}
          <ListGroup>
            {sections.map(({ path, icon: Icon, label, color }) => (
              <ListRow
                key={path}
                href={`/trips/${trip.id}/${path}`}
                icon={<Icon aria-hidden className={cn('size-5', color)} />}
                title={label}
              />
            ))}
          </ListGroup>
        </aside>

        <div className="min-w-0">
          <div className="sticky top-0 z-10 bg-background pt-1 pb-2">
            <div className="flex items-center gap-2 px-4 md:px-0">
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
                      <span className={cn('text-xs', !on && 'text-muted-foreground')}>
                        {f.day(d)}
                      </span>
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
              />
            )}
          </div>
        </div>
      </div>

      <Sheet open={calendarOpen} onClose={() => setCalendarOpen(false)} title={t('calendar.title')}>
        {calendar}
      </Sheet>

      {canEdit && <Fab href={`/trips/${trip.id}/items/new?day=${day}`} label={t('common.add')} />}
    </>
  )
}
