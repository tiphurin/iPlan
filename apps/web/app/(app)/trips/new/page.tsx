import { getTranslations } from 'next-intl/server'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { TripForm } from '@/components/trips/trip-form'

export default async function NewTripPage() {
  const t = await getTranslations()
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href="/trips" label={t('nav.trips')} />
      </div>
      <PageHeader title={t('trips.new')} />
      <TripForm />
    </>
  )
}
