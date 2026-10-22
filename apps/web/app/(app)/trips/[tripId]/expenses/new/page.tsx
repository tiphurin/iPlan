import { PoolDto } from '@iplan/contracts'
import { todayKey } from '@iplan/i18n'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { ExpenseForm } from '@/components/trips/expense-form'
import { loadTrip } from '@/lib/load-trip'
import { modeOfLine } from '@/lib/lines'
import { serverApi } from '@/lib/server-api'
import { zoneCurrency } from '@/lib/time-zones'

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>
  searchParams: Promise<{ item?: string; from?: string }>
}) {
  const { tripId } = await params
  const { item: itemId, from } = await searchParams
  const [t, { trip, items }, pool] = await Promise.all([
    getTranslations(),
    loadTrip(tripId),
    serverApi(`/api/trips/${tripId}/pool`, PoolDto),
  ])
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
  // From a place: back to its edit page (opened there) or to the plan with it in view.
  const back = !place
    ? { href: `/trips/${tripId}/expenses`, label: t('expenses.title') }
    : from === 'item'
      ? { href: `/trips/${tripId}/items/${place.id}`, label: place.title }
      : { href: `/trips/${tripId}?day=${place.dayDate}&focus=${place.id}`, label: trip.name }
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink history href={back.href as Route} label={back.label} />
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
        returnTo={place ? back.href : undefined}
        poolLeftMinor={pool.leftoverBaseMinor}
      />
    </>
  )
}
