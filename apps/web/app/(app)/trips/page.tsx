import { TripDto } from '@iplan/contracts'
import { type Locale, todayKey } from '@iplan/i18n'
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
import { serverApi } from '@/lib/server-api'
import { type TripPhase, tripPhase } from '@/lib/trip-dates'

export const metadata: Metadata = { title: 'Trips' }

const ORDER: TripPhase[] = ['ongoing', 'upcoming', 'past']

export default async function TripsPage() {
  const [t, locale, trips] = await Promise.all([
    getTranslations(),
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
      </div>
    </>
  )
}
