import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { ItemForm } from '@/components/trips/item-form'
import { loadTrip } from '@/lib/load-trip'

interface Props {
  params: Promise<{ tripId: string }>
  searchParams: Promise<{ day?: string }>
}

export default async function NewItemPage({ params, searchParams }: Props) {
  const [{ tripId }, { day }] = await Promise.all([params, searchParams])
  const [t, { trip, items }] = await Promise.all([getTranslations(), loadTrip(tripId)])
  if (trip.role === 'viewer') notFound()
  const defaultDay = day && day >= trip.startDate && day <= trip.endDate ? day : trip.startDate
  // New items continue in the zone of the last item that day (e.g. Seoul after landing).
  const lastThatDay = items.filter((i) => i.dayDate === defaultDay).at(-1)
  const defaultTimeZone =
    lastThatDay?.details.arrivalTimeZone ?? lastThatDay?.timeZone ?? trip.homeTimeZone
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href={`/trips/${tripId}?day=${defaultDay}` as Route} label={trip.name} />
      </div>
      <PageHeader title={t('item.new')} />
      <ItemForm trip={trip} defaultDay={defaultDay} defaultTimeZone={defaultTimeZone} />
    </>
  )
}
