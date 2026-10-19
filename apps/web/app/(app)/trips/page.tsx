import { AdminTripDto, TripDto, isAdminRole } from '@iplan/contracts'
import { type Locale, formatDateRange, todayKey } from '@iplan/i18n'
import { Plus } from 'lucide-react'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { ImportTrip } from '@/components/trips/import-trip'
import { TripCover } from '@/components/trips/trip-cover'
import { buttonVariants } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { getMe, serverApi } from '@/lib/server-api'
import { tripColor } from '@/lib/trip-color'
import { ScopeTabs } from '@/components/scope-tabs'
import { type TripPhase, tripPhase } from '@/lib/trip-dates'

export const metadata: Metadata = { title: 'Trips' }

const ORDER: TripPhase[] = ['ongoing', 'upcoming', 'past']

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const [t, locale, trips, me, { scope: rawScope }] = await Promise.all([
    getTranslations(),
    getLocale(),
    serverApi('/api/trips', z.array(TripDto)),
    getMe(),
    searchParams,
  ])
  const admin = me ? isAdminRole(me.role) : false
  const scope = admin && rawScope === 'all' ? 'all' : 'mine'
  const everyone = scope === 'all' ? await serverApi('/api/admin/trips', z.array(AdminTripDto)) : []
  const grouped = new Map<TripPhase, TripDto[]>()
  for (const trip of trips) {
    const phase = tripPhase(trip, todayKey(trip.homeTimeZone))
    grouped.set(phase, [...(grouped.get(phase) ?? []), trip])
  }

  return (
    <>
      <PageHeader
        title={t('features.trips')}
        action={
          <Link
            href="/trips/new"
            className={buttonVariants({ variant: 'solid', className: 'px-4' })}
          >
            <Plus aria-hidden className="size-5" />
            {t('trips.newShort')}
          </Link>
        }
      />
      <div className="space-y-6 px-4">
        {admin && (
          <ScopeTabs
            base="/trips"
            scope={scope}
            labels={{ mine: t('scope.mine'), all: t('scope.allTrips') }}
          />
        )}
        {scope === 'all' ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {everyone.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}` as Route}
                  className="flex min-h-[64px] items-center gap-3 rounded-2xl border bg-card px-4 py-3 active:bg-muted"
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: tripColor(trip.id) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{trip.name}</span>
                    <span className="block truncate text-xs text-faint">
                      {formatDateRange(trip.startDate, trip.endDate, { locale: locale as Locale })}{' '}
                      · {t('scope.owner', { name: trip.ownerName ?? '—' })} ·{' '}
                      {t('trips.members', { count: trip.memberCount })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <>
            {trips.length === 0 && (
              <Card className="py-10 text-center">
                <p className="font-display text-xl font-semibold">{t('trips.empty')}</p>
                <p className="mt-1 text-muted-foreground">{t('trips.emptyHint')}</p>
                <Link href="/trips/new" className={buttonVariants({ className: 'mt-5' })}>
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
                        <Link
                          href={`/trips/${trip.id}` as Route}
                          className="block transition-transform active:scale-[0.99]"
                        >
                          <TripCover trip={trip} locale={locale as Locale} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
            <ImportTrip />
          </>
        )}
      </div>
    </>
  )
}
