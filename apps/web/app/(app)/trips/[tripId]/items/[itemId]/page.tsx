import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { ItemDetail } from '@/components/trips/item-detail'
import { ItemForm } from '@/components/trips/item-form'
import { ItemRow } from '@/components/trips/item-row'
import { loadTrip } from '@/lib/load-trip'

interface Props {
  params: Promise<{ tripId: string; itemId: string }>
}

export default async function ItemPage({ params }: Props) {
  const { tripId, itemId } = await params
  const [t, { trip, items }] = await Promise.all([getTranslations(), loadTrip(tripId)])
  const item = items.find((i) => i.id === itemId)
  if (!item) notFound()
  const canEdit = trip.role !== 'viewer'
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href={`/trips/${tripId}?day=${item.dayDate}` as Route} label={trip.name} />
      </div>
      <PageHeader title={canEdit ? t('item.edit') : item.title} />
      {!canEdit && (
        <div className="px-4 pb-4">
          <ItemRow item={item} homeTimeZone={trip.homeTimeZone} />
        </div>
      )}
      <ItemDetail item={item} />
      {canEdit && (
        <ItemForm
          trip={trip}
          item={item}
          defaultDay={item.dayDate}
          defaultTimeZone={item.timeZone}
        />
      )}
    </>
  )
}
