import { TripDto } from '@iplan/contracts'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { TripForm } from '@/components/trips/trip-form'
import { serverApi } from '@/lib/server-api'
import { suggestTripColor } from '@/lib/trip-color'

export default async function NewTripPage() {
  const [t, trips] = await Promise.all([
    getTranslations(),
    serverApi('/api/trips', z.array(TripDto)),
  ])
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href="/trips" label={t('nav.trips')} />
      </div>
      <PageHeader title={t('trips.new')} />
      <TripForm suggestedColor={suggestTripColor(trips)} />
    </>
  )
}
