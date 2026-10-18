'use client'

import type { TripDetailDto, TripItemDto } from '@iplan/contracts'
import { currentTripDay, delayMinutes, punctuality, scheduleStatus, timeline } from '@iplan/core'
import { Check, FastForward, FlaskConical, RotateCcw, Undo2 } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { BackLink } from '@/components/back-link'
import { Button } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/cn'
import { KIND_STYLE } from '@/lib/item-kinds'
import { zoneCity } from '@/lib/time-zones'
import { useItemMutations, useItems, useTrip } from '@/lib/trips'
import { useFormat } from '@/lib/use-format'
import { ItemRow, type RowStatus } from './item-row'
import { SleepCard } from './sleep-card'

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

export function TodayView({
  initialTrip,
  initialItems,
  meId,
  serverNow,
}: {
  initialTrip: TripDetailDto
  initialItems: TripItemDto[]
  meId: string
  serverNow: number
}) {
  const t = useTranslations()
  const f = useFormat()
  const { data: trip } = useTrip(initialTrip.id, initialTrip)
  const { data: items } = useItems(initialTrip.id, initialItems)
  const mutations = useItemMutations(trip.id)
  const { now, offset, setOffset } = useNow(serverNow)
  const [showSimulator, setShowSimulator] = useState(false)

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
  const clockZone = current?.timeZone ?? next?.timeZone ?? trip.homeTimeZone

  const dayLine = timeline(
    dayItems.map((i) => ({ ...i, startsAt: i.startsAtDate, endsAt: i.endsAtDate })),
  )
  const rowStatus = (id: string): RowStatus => {
    if (id === current?.id) return 'now'
    const entry = dayLine.find((x) => x.item.id === id)
    return entry && entry.end <= now.getTime() ? 'done' : 'upcoming'
  }

  const myCheckIn = current?.checkIns.find((c) => c.userId === meId)
  const delay = myCheckIn
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
      <div className="flex items-center justify-between px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink
          href={`/trips/${trip.id}${day ? `?day=${day}` : ''}` as Route}
          label={trip.name}
        />
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
        <p className="text-5xl font-bold tracking-tight tabular-nums" suppressHydrationWarning>
          {f.time(now, clockZone)}
        </p>
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
              onClick={() => next && setOffset(next.startsAtDate.getTime() + MINUTE - Date.now())}
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

      <div className="space-y-4 px-4">
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
              <Card className="border-primary/40 bg-primary/5">
                <div className="flex items-start gap-3">
                  <KindBadge item={current} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                      {t('todayView.now')}
                    </p>
                    <p className="text-xl leading-snug font-semibold">{current.title}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {f.time(current.startsAt, current.timeZone)}
                      {current.endsAt &&
                        ` – ${f.time(current.endsAt, current.details.arrivalTimeZone ?? current.timeZone)}`}
                    </p>
                  </div>
                </div>
                <Progress value={status.current.progress} className="mt-4" />
                <p className="mt-2 text-sm text-muted-foreground" suppressHydrationWarning>
                  {t('todayView.remaining', { time: f.duration(status.current.remainingMs) })}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  {myCheckIn ? (
                    <>
                      <p className="flex flex-1 items-center gap-1.5 text-sm font-medium text-success">
                        <Check aria-hidden className="size-4" />
                        {delayText}
                      </p>
                      <Button
                        variant="ghost"
                        onClick={() => mutations.undoCheckIn.mutate(current.id)}
                        disabled={mutations.undoCheckIn.isPending}
                      >
                        <Undo2 aria-hidden className="size-4" />
                        {t('todayView.undoCheckIn')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => mutations.checkIn.mutate({ id: current.id, at: now })}
                      disabled={mutations.checkIn.isPending}
                    >
                      <Check aria-hidden className="size-5" />
                      {t('todayView.checkIn')}
                    </Button>
                  )}
                </div>
              </Card>
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
              <Card className="flex items-center gap-3">
                <KindBadge item={next} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {t('todayView.next')} · {f.time(next.startsAt, next.timeZone)}
                  </p>
                  <p className="truncate font-semibold">{next.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t('todayView.startsIn')}</p>
                  <p className="text-xl font-bold tabular-nums" suppressHydrationWarning>
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

        {dayItems.length > 0 && (
          <section>
            <SectionTitle>{day && f.day(day)}</SectionTitle>
            <ol className="space-y-2">
              {dayItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/trips/${trip.id}/items/${item.id}` as Route}
                    className="block active:opacity-80"
                  >
                    <ItemRow
                      item={item}
                      homeTimeZone={trip.homeTimeZone}
                      status={rowStatus(item.id)}
                      meId={meId}
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
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
