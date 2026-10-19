import { todayKey } from '@iplan/i18n'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { ExpenseForm } from '@/components/trips/expense-form'
import { loadTrip } from '@/lib/load-trip'

export default async function NewExpensePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const [t, { trip, items }] = await Promise.all([getTranslations(), loadTrip(tripId)])
  if (trip.role === 'viewer') notFound()
  const today = todayKey(trip.homeTimeZone)
  const defaultDay = today >= trip.startDate && today <= trip.endDate ? today : trip.startDate
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href={`/trips/${tripId}/expenses` as Route} label={t('expenses.title')} />
      </div>
      <PageHeader title={t('expenses.add')} />
      <ExpenseForm trip={trip} items={items} defaultDay={defaultDay} />
    </>
  )
}
