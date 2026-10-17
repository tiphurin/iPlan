import { TripDto } from '@iplan/contracts'
import { type Locale, formatDateRange, todayKey } from '@iplan/i18n'
import { ChevronRight, Plus, Users } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { getMe, serverApi } from '@/lib/server-api'
import { type TripPhase, tripPhase } from '@/lib/trip-dates'

const ORDER: TripPhase[] = ['ongoing', 'upcoming', 'past']

export default async function TripsPage() {
  const [t, me, locale, trips] = await Promise.all([
    getTranslations(),
    getMe(),
    getLocale(),
    serverApi('/api/trips', z.array(TripDto)),
  ])
  const grouped = new Map<TripPhase, TripDto[]>()
  for (const trip of trips) {
    const phase = tripPhase(trip, todayKey(trip.homeTimeZone))
    grouped.set(phase, [...(grouped.get(phase) ?? []), trip])
  }

  return (
    <>
      <PageHeader
        title={t('nav.trips')}
        subtitle={t('home.greeting', { name: me?.name ?? '' })}
        action={
          <Link
            href="/trips/new"
            aria-label={t('trips.new')}
            className={buttonVariants({ size: 'icon', className: 'rounded-full' })}
          >
            <Plus aria-hidden className="size-6" />
          </Link>
        }
      />
      <div className="space-y-6 px-4">
        {trips.length === 0 && (
          <Card className="py-10 text-center">
            <p className="text-lg font-semibold">{t('trips.empty')}</p>
            <p className="mt-1 text-muted-foreground">{t('trips.emptyHint')}</p>
            <Link href="/trips/new" className={cn(buttonVariants(), 'mt-5')}>
              {t('trips.new')}
            </Link>
          </Card>
        )}
        {ORDER.map((phase) => {
          const list = grouped.get(phase)
          if (!list?.length) return null
          return (
            <section key={phase}>
              <SectionTitle>{t(`trips.${phase}`)}</SectionTitle>
              <ul className="space-y-3">
                {(phase === 'past' ? [...list].reverse() : list).map((trip) => (
                  <li key={trip.id}>
                    <Link href={`/trips/${trip.id}` as Route} className="block active:opacity-80">
                      <Card
                        className={cn(
                          'flex items-center gap-3',
                          phase === 'ongoing' && 'border-primary/40 bg-primary/5',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-semibold">{trip.name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {formatDateRange(trip.startDate, trip.endDate, {
                              locale: locale as Locale,
                            })}
                            {trip.destination && ` · ${trip.destination}`}
                          </p>
                          <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <Users aria-hidden className="size-3.5" />
                            {t('trips.members', { count: trip.memberCount })}
                            <span className="rounded-full bg-muted px-2 py-0.5">
                              {t(`trips.role.${trip.role}`)}
                            </span>
                          </p>
                        </div>
                        <ChevronRight
                          aria-hidden
                          className="size-5 shrink-0 text-muted-foreground"
                        />
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}
