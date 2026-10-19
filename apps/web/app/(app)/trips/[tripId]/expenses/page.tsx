import { ExpenseDto, ExpenseSummaryDto } from '@iplan/contracts'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { ExpensesView } from '@/components/trips/expenses-view'
import { loadTrip } from '@/lib/load-trip'
import { serverApi } from '@/lib/server-api'

export default async function ExpensesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const [t, { trip }, expenses, summary] = await Promise.all([
    getTranslations(),
    loadTrip(tripId),
    serverApi(`/api/trips/${tripId}/expenses`, z.array(ExpenseDto)),
    serverApi(`/api/trips/${tripId}/expenses/summary`, ExpenseSummaryDto),
  ])
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href={`/trips/${tripId}` as Route} label={trip.name} />
      </div>
      <PageHeader title={t('expenses.title')} />
      <ExpensesView initialTrip={trip} initialExpenses={expenses} initialSummary={summary} />
    </>
  )
}
