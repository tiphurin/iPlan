'use client'

import type { TripDetailDto, TripItemDto } from '@iplan/contracts'
import { currentTripDay } from '@iplan/core'
import { formatDateRange } from '@iplan/i18n'
import { ClipboardList, Clock, Info, Pencil, Plus, Users, Wallet } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef } from 'react'
import { BackLink } from '@/components/back-link'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { tripDays } from '@/lib/trip-dates'
import { useItems, useTrip } from '@/lib/trips'
import { useFormat } from '@/lib/use-format'
import { ItemRow } from './item-row'

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
  const dayItems = items.filter((i) => i.dayDate === day)

  // Keep the selected day chip in view.
  const selectedRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [day])

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href="/" label={t('nav.trips')} />
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
        <h1 className="text-3xl font-bold tracking-tight">{trip.name}</h1>
        <p className="text-muted-foreground">
          {formatDateRange(trip.startDate, trip.endDate, { locale: f.locale })}
          {trip.destination && ` · ${trip.destination}`}
        </p>
        <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {(
            [
              ['today', Clock, t('trips.openToday')],
              ['expenses', Wallet, t('trips.expenses')],
              ['checklist', ClipboardList, t('trips.checklist')],
              ['info', Info, t('trips.info')],
              ['members', Users, t('trips.members', { count: trip.members.length })],
            ] as const
          ).map(([path, Icon, label]) => (
            <Link
              key={path}
              href={`/trips/${trip.id}/${path}` as Route}
              className={cn(buttonVariants({ variant: 'secondary' }), 'shrink-0')}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <nav
        aria-label={t('item.day')}
        className="sticky top-0 z-10 -mb-1 flex snap-x gap-2 overflow-x-auto border-b bg-background/90 px-4 py-2 backdrop-blur-xl [scrollbar-width:none]"
      >
        {days.map((d, index) => (
          <button
            key={d}
            ref={d === day ? selectedRef : undefined}
            type="button"
            onClick={() => router.replace(`${pathname}?day=${d}` as Route, { scroll: false })}
            aria-pressed={d === day}
            className={cn(
              'min-h-11 shrink-0 snap-center rounded-xl px-3 text-left text-sm leading-tight',
              d === day ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
            )}
          >
            <span className="block text-[11px] opacity-80">
              {t('trips.dayN', { n: index + 1 })}
            </span>
            <span className="font-medium">{f.day(d)}</span>
          </button>
        ))}
      </nav>

      <ol className="space-y-2 px-4 pt-4">
        {dayItems.length === 0 && (
          <Card className="text-center text-muted-foreground">{t('trips.noItems')}</Card>
        )}
        {dayItems.map((item) => (
          <li key={item.id}>
            <Link
              href={`/trips/${trip.id}/items/${item.id}` as Route}
              className="block active:opacity-80"
            >
              <ItemRow item={item} homeTimeZone={trip.homeTimeZone} meId={meId} />
            </Link>
          </li>
        ))}
      </ol>

      {canEdit && (
        <Link
          href={`/trips/${trip.id}/items/new?day=${day}` as Route}
          aria-label={t('trips.addItem')}
          className={cn(
            buttonVariants({ size: 'icon' }),
            'fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg',
          )}
        >
          <Plus aria-hidden className="size-7" />
        </Link>
      )}
    </>
  )
}
