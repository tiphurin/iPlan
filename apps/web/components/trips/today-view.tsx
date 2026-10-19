'use client'

import type { TripDetailDto, TripItemDto } from '@iplan/contracts'
import { currentTripDay, delayMinutes, punctuality, scheduleStatus, timeline } from '@iplan/core'
import { Check, FastForward, FlaskConical, RotateCcw, SkipForward, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, Hero, SectionTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/cn'
import { KIND_STYLE } from '@/lib/item-kinds'
import { zoneCity } from '@/lib/time-zones'
import { useItemMutations, useItems, useTrip } from '@/lib/trips'
import { useFormat } from '@/lib/use-format'
import { dayColor } from '@/lib/day-colors'
import { tripDays } from '@/lib/trip-dates'
import { awayZone } from '@/lib/time-zones'
import { TripDisplayProvider, useTripDisplay } from '@/lib/trip-display'
import { SleepCard } from './sleep-card'
import { ItemSheet } from './item-sheet'
import { TripTopBar } from './trip-top-bar'
import { DisplaySwitches } from './display-switches'
import { type RowStatus, Timeline } from './timeline'

interface Timed extends TripItemDto {
  startsAtDate: Date
  endsAtDate: Date | null
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Real clock plus an optional simulator offset; ticks every second after mount. */
function useNow(serverNow: number) {
  const [real, setReal] = useState(serverNow)
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const tick = () => setReal(Date.now())
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [])
  return { now: new Date(real + offset), offset, setOffset }
}

interface TodayProps {
  initialTrip: TripDetailDto
  initialItems: TripItemDto[]
  meId: string
  serverNow: number
}

/** Simulator offset that makes "now" equal `target`. */
function offsetTo(target: number): number {
  return target - Date.now()
}

/** Minutes after the start before an unchecked item counts as late. */
const LATE_AFTER_MIN = 5
/** The next item turns orange this many minutes before it starts. */
const SOON_MIN = 15

export function TodayView(props: TodayProps) {
  return (
    <TripDisplayProvider tripId={props.initialTrip.id}>
      <TodayBody {...props} />
    </TripDisplayProvider>
  )
}

function TodayBody({ initialTrip, initialItems, meId, serverNow }: TodayProps) {
  const t = useTranslations()
  const { display } = useTripDisplay()
  const f = useFormat()
  const { data: trip } = useTrip(initialTrip.id, initialTrip)
  const { data: items } = useItems(initialTrip.id, initialItems)
  const mutations = useItemMutations(trip.id)
  const { now, offset, setOffset } = useNow(serverNow)
  const [showSimulator, setShowSimulator] = useState(false)
  const [openItemId, setOpenItemId] = useState<string | null>(null)

  const timed: Timed[] = useMemo(
    () =>
      items.map((i) => ({
        ...i,
        startsAtDate: new Date(i.startsAt),
        endsAtDate: i.endsAt ? new Date(i.endsAt) : null,
      })),
    [items],
  )
  const whole = useMemo(
    () =>
      timeline(
        timed.map((i) => ({ ...i, id: i.id, startsAt: i.startsAtDate, endsAt: i.endsAtDate })),
      ),
    [timed],
  )
  const tripStart = whole[0]?.start
  const tripEnd = whole.at(-1)?.end
  const day = currentTripDay(
    timed.map((i) => ({ dayDate: i.dayDate, startsAt: i.startsAtDate })),
    now,
  )
  const dayItems = timed.filter((i) => i.dayDate === day)
  const status = scheduleStatus(
    dayItems.map((i) => ({ ...i, startsAt: i.startsAtDate, endsAt: i.endsAtDate })),
    now,
  )
  // Status across the whole trip so the "next" item can be on tomorrow's list.
  const nextAnywhere = whole.find((x) => x.start > now.getTime())
  const current = status.current ? timed.find((i) => i.id === status.current?.item.id) : undefined
  const next = nextAnywhere ? timed.find((i) => i.id === nextAnywhere.item.id) : undefined
  const placeZone = current?.timeZone ?? next?.timeZone ?? trip.homeTimeZone
  const clockZone = display.time === 'home' ? trip.homeTimeZone : placeZone
  const away = awayZone(items, trip.homeTimeZone)

  const dayLine = timeline(
    dayItems.map((i) => ({ ...i, startsAt: i.startsAtDate, endsAt: i.endsAtDate })),
  )
  const rowStatus = (id: string): RowStatus => {
    if (id === current?.id) return 'now'
    const entry = dayLine.find((x) => x.item.id === id)
    return entry && entry.end <= now.getTime() ? 'done' : 'upcoming'
  }

  const myCheckIn = current?.checkIns.find((c) => c.userId === meId)
  const skipped = myCheckIn?.skipped === true
  const lateMin =
    current && !myCheckIn
      ? Math.floor((now.getTime() - current.startsAtDate.getTime()) / MINUTE)
      : null
  const late = lateMin !== null && lateMin >= LATE_AFTER_MIN
  const nextIn = next ? next.startsAtDate.getTime() - now.getTime() : null
  const soon = nextIn !== null && nextIn <= SOON_MIN * MINUTE
  const delay =
    myCheckIn && !skipped
      ? delayMinutes(new Date(current?.startsAt ?? 0), new Date(myCheckIn.checkedInAt))
      : null
  const delayText =
    delay === null
      ? null
      : {
          late: t('todayView.late', { min: delay }),
          early: t('todayView.early', { min: -delay }),
          on_time: t('todayView.onTime'),
        }[punctuality(delay)]

  const before = tripStart !== undefined && now.getTime() < tripStart
  const after = tripEnd !== undefined && now.getTime() >= tripEnd

  return (
    <>
      <TripTopBar trip={trip} view="today" day={day ?? undefined} />
      <div className="flex justify-end px-4 pt-2">
        <Button
          variant={offset ? 'primary' : 'ghost'}
          size="icon"
          aria-label={t('todayView.simulator')}
          aria-expanded={showSimulator}
          onClick={() => setShowSimulator((v) => !v)}
        >
          <FlaskConical aria-hidden className="size-5" />
        </Button>
      </div>

      <header className="px-4 pb-4">
        <p className="text-sm text-muted-foreground">
          {day ? f.day(day) : t('today.title')} · {zoneCity(clockZone)}
        </p>
        <p className="num text-5xl font-bold" suppressHydrationWarning>
          {f.time(now, clockZone)}
        </p>
        {away && (
          <div className="mt-3">
            <DisplaySwitches trip={trip} away={away} serverNow={serverNow} />
          </div>
        )}
        {offset !== 0 && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
            <FlaskConical aria-hidden className="size-3.5" />
            {t('todayView.simulating')}
          </p>
        )}
      </header>

      {showSimulator && (
        <Card className="mx-4 mb-4 space-y-2">
          <SectionTitle className="px-0 pb-0">{t('todayView.simulator')}</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ['-1h', -HOUR],
                ['+15m', 15 * MINUTE],
                ['+1h', HOUR],
                ['+1d', 24 * HOUR],
              ] as const
            ).map(([label, delta]) => (
              <Button key={label} variant="secondary" onClick={() => setOffset((o) => o + delta)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              disabled={!next}
              onClick={() => next && setOffset(offsetTo(next.startsAtDate.getTime() + MINUTE))}
            >
              <FastForward aria-hidden className="size-4" />
              {t('todayView.jumpNext')}
            </Button>
            <Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(0)}>
              <RotateCcw aria-hidden className="size-4" />
              {t('todayView.resetTime')}
            </Button>
          </div>
        </Card>
      )}

      <div className="px-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6">
        <div className="space-y-4 md:sticky md:top-4">
          {before && tripStart !== undefined && (
            <Card className="text-center">
              <p className="text-muted-foreground">{t('todayView.beforeTrip')}</p>
              <p className="text-3xl font-bold tabular-nums">
                {f.duration(tripStart - now.getTime())}
              </p>
            </Card>
          )}
          {after && (
            <Card className="text-center text-muted-foreground">{t('todayView.afterTrip')}</Card>
          )}

          {!before && !after && (
            <>
              {current && status.current ? (
                <Hero variant="solid" tone={late ? 'red' : skipped ? 'ink' : 'green'}>
                  <p className="text-sm font-semibold opacity-95">
                    {late
                      ? t('todayView.lateNow', { min: lateMin ?? 0 })
                      : skipped
                        ? t('todayView.skippedNow')
                        : t('todayView.now')}
                  </p>
                  <p
                    className={cn(
                      'my-1 font-display text-[28px] leading-tight font-bold',
                      skipped && 'line-through opacity-70',
                    )}
                  >
                    {current.title}
                  </p>
                  <p className="text-[15px] tabular-nums opacity-95">
                    {f.time(current.startsAt, clockZone)}
                    {current.endsAt &&
                      ` – ${f.time(
                        current.endsAt,
                        display.time === 'home'
                          ? trip.homeTimeZone
                          : (current.details.arrivalTimeZone ?? current.timeZone),
                      )}`}
                  </p>
                  <div className="mt-4 h-[9px] overflow-hidden rounded-full bg-white/25">
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-700"
                      style={{ width: `${Math.round(status.current.progress * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm opacity-90" suppressHydrationWarning>
                    {t('todayView.remaining', { time: f.duration(status.current.remainingMs) })}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    {myCheckIn ? (
                      <>
                        <p className="flex flex-1 items-center gap-1.5 text-sm font-semibold">
                          {skipped ? (
                            <SkipForward aria-hidden className="size-4" />
                          ) : (
                            <Check aria-hidden className="size-4" />
                          )}
                          {skipped ? t('timeline.skipped') : delayText}
                        </p>
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm"
                          onClick={() => mutations.undoCheckIn.mutate(current.id)}
                          disabled={mutations.undoCheckIn.isPending}
                        >
                          <Undo2 aria-hidden className="size-4" />
                          {t('todayView.undoCheckIn')}
                        </button>
                      </>
                    ) : (
                      <div className="grid w-full grid-cols-[1fr_auto] gap-2">
                        <button
                          type="button"
                          className={cn(
                            'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white font-semibold disabled:opacity-60',
                            late ? 'text-[#c93a32]' : 'text-[#00873e]',
                          )}
                          onClick={() => mutations.checkIn.mutate({ id: current.id, at: now })}
                          disabled={mutations.checkIn.isPending}
                        >
                          <Check aria-hidden className="size-5" />
                          {t('todayView.checkIn')}
                        </button>
                        <button
                          type="button"
                          className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/15 px-4 font-semibold disabled:opacity-60"
                          onClick={() =>
                            mutations.checkIn.mutate({ id: current.id, at: now, skipped: true })
                          }
                          disabled={mutations.checkIn.isPending}
                        >
                          <SkipForward aria-hidden className="size-5" />
                          {t('todayView.skip')}
                        </button>
                      </div>
                    )}
                  </div>
                </Hero>
              ) : (
                <Card>
                  <p className="font-semibold">
                    {status.next || next ? t('todayView.free') : t('todayView.dayDone')}
                  </p>
                  {(status.next || next) && (
                    <p className="text-sm text-muted-foreground">{t('todayView.freeHint')}</p>
                  )}
                </Card>
              )}

              {next && (
                <Card
                  className={cn(
                    'flex items-center gap-3',
                    soon && 'border-2 border-[#ef7c1c] bg-[#ef7c1c]/10',
                  )}
                >
                  <KindBadge item={next} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-xs font-semibold tracking-wide uppercase',
                        soon ? 'text-[#ef7c1c]' : 'text-muted-foreground',
                      )}
                    >
                      {soon ? t('todayView.getReady') : t('todayView.next')} ·{' '}
                      {f.time(
                        next.startsAt,
                        display.time === 'home' ? trip.homeTimeZone : next.timeZone,
                      )}
                    </p>
                    <p className="truncate font-semibold">{next.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t('todayView.startsIn')}</p>
                    <p
                      className={cn('text-xl font-bold tabular-nums', soon && 'text-[#ef7c1c]')}
                      suppressHydrationWarning
                    >
                      {f.clock(next.startsAtDate.getTime() - now.getTime())}
                    </p>
                  </div>
                </Card>
              )}

              <SleepCard items={items} meId={meId} now={now} />

              <Card>
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-sm font-medium">{t('todayView.dayProgress')}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {t('todayView.doneOf', { done: status.completed, total: status.total })}
                  </p>
                </div>
                <Progress value={status.dayProgress} />
              </Card>
            </>
          )}
        </div>
        {dayItems.length > 0 && (
          <section className="mt-4 md:mt-0">
            <SectionTitle>{day && f.day(day)}</SectionTitle>
            <Timeline
              items={dayItems}
              tripId={trip.id}
              homeTimeZone={trip.homeTimeZone}
              color={dayColor(day ? tripDays(trip.startDate, trip.endDate).indexOf(day) : 1)}
              meId={meId}
              statusOf={rowStatus}
              spent={{ currency: trip.baseCurrency, rates: trip.fxRates }}
              onOpen={(item) => setOpenItemId(item.id)}
            />
          </section>
        )}
      </div>
      <ItemSheet
        item={items.find((i) => i.id === openItemId) ?? null}
        trip={trip}
        spent={{ currency: trip.baseCurrency, rates: trip.fxRates }}
        onClose={() => setOpenItemId(null)}
      />
    </>
  )
}

function KindBadge({ item }: { item: TripItemDto }) {
  const { icon: Icon, tone } = KIND_STYLE[item.kind]
  return (
    <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tone)}>
      <Icon aria-hidden className="size-6" />
    </div>
  )
}
