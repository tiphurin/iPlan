import { Wallet } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Attachments } from '@/components/attachments'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
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
        <BackLink
          href={`/trips/${tripId}?day=${item.dayDate}&focus=${item.id}` as Route}
          label={trip.name}
          history
        />
      </div>
      <PageHeader title={canEdit ? t('item.edit') : item.title} />
      {!canEdit && (
        <div className="px-4 pb-4">
          <ItemRow item={item} homeTimeZone={trip.homeTimeZone} />
        </div>
      )}
      <ItemDetail item={item} />
      {canEdit && item.kind !== 'wake' && item.kind !== 'sleep' && (
        <div className="px-4 pb-4">
          <Link
            href={`/trips/${tripId}/expenses/new?item=${item.id}` as Route}
            className={buttonVariants({ variant: 'secondary', size: 'lg' })}
          >
            <Wallet aria-hidden className="size-5 text-l1" />
            {t('expenses.addHere')}
          </Link>
        </div>
      )}
      <div className="px-4 pb-4">
        <Attachments entityType="trip_item" entityId={item.id} canEdit={canEdit} kind="photo" />
      </div>
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
