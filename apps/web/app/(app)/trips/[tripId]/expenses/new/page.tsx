import { todayKey } from '@iplan/i18n'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { ExpenseForm } from '@/components/trips/expense-form'
import { loadTrip } from '@/lib/load-trip'
import { modeOfLine } from '@/lib/lines'
import { zoneCurrency } from '@/lib/time-zones'

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>
  searchParams: Promise<{ item?: string }>
}) {
  const { tripId } = await params
  const { item: itemId } = await searchParams
  const [t, { trip, items }] = await Promise.all([getTranslations(), loadTrip(tripId)])
  if (trip.role === 'viewer') notFound()
  const today = todayKey(trip.homeTimeZone)
  // "Add expense here" from a place: that place, its day and the local currency.
  const place = items.find((i) => i.id === itemId)
  const defaultDay = place
    ? place.dayDate
    : today >= trip.startDate && today <= trip.endDate
      ? today
      : trip.startDate
  const local = place ? zoneCurrency(place.timeZone) : undefined
  const defaultCurrency =
    local && (local === trip.baseCurrency || trip.fxRates[local]) ? local : undefined
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink history href={`/trips/${tripId}/expenses` as Route} label={t('expenses.title')} />
      </div>
      <PageHeader title={t('expenses.add')} />
      <ExpenseForm
        trip={trip}
        items={items}
        defaultDay={defaultDay}
        defaultItemId={place?.id}
        defaultCurrency={defaultCurrency}
        defaultCategory={
          place?.kind === 'move' || place?.kind === 'flight' ? 'transport' : undefined
        }
        defaultSubcategory={place?.kind === 'flight' ? 'plane' : modeOfLine(place?.details.line)}
        returnTo={place ? `/trips/${tripId}?day=${place.dayDate}&focus=${place.id}` : undefined}
      />
    </>
  )
}
