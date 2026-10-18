import { TripDto } from '@iplan/contracts'
import { todayKey } from '@iplan/i18n'
import type { Route } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { serverApi } from '@/lib/server-api'
import { tripPhase } from '@/lib/trip-dates'

/** Opens the trip happening now, or the next one coming up. */
export default async function TodayPage() {
  const trips = await serverApi('/api/trips', z.array(TripDto))
  const phase = (trip: TripDto) => tripPhase(trip, todayKey(trip.homeTimeZone))
  const pick =
    trips.find((trip) => phase(trip) === 'ongoing') ??
    trips
      .filter((trip) => phase(trip) === 'upcoming')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
  if (pick) redirect(`/trips/${pick.id}/today` as Route)

  const t = await getTranslations()
  return (
    <>
      <PageHeader title={t('today.title')} />
      <div className="px-4">
        <Card className="py-8 text-center">
          <p className="text-muted-foreground">{t('todayView.noTrip')}</p>
          <Link href="/trips/new" className={buttonVariants({ className: 'mt-4' })}>
            {t('trips.new')}
          </Link>
        </Card>
      </div>
    </>
  )
}
