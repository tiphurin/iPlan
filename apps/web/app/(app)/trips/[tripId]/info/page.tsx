import { InfoCardDto } from '@iplan/contracts'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { InfoView } from '@/components/trips/info-view'
import { loadTrip } from '@/lib/load-trip'
import { serverApi } from '@/lib/server-api'

export default async function InfoPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const [t, { trip }, cards] = await Promise.all([
    getTranslations(),
    loadTrip(tripId),
    serverApi(`/api/trips/${tripId}/info`, z.array(InfoCardDto)),
  ])
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href={`/trips/${tripId}` as Route} label={trip.name} />
      </div>
      <PageHeader title={t('info.title')} />
      <InfoView trip={trip} initialCards={cards} />
    </>
  )
}
