import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { TripForm } from '@/components/trips/trip-form'
import { loadTrip } from '@/lib/load-trip'

export default async function EditTripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const [t, { trip }] = await Promise.all([getTranslations(), loadTrip(tripId)])
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href={`/trips/${tripId}` as Route} label={trip.name} />
      </div>
      <PageHeader title={t('trips.editTrip')} />
      <TripForm trip={trip} />
    </>
  )
}
