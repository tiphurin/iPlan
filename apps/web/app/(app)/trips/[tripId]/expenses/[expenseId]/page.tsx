import { ExpenseDto } from '@iplan/contracts'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { ExpenseForm } from '@/components/trips/expense-form'
import { loadTrip } from '@/lib/load-trip'
import { serverApi } from '@/lib/server-api'

export default async function ExpensePage({
  params,
}: {
  params: Promise<{ tripId: string; expenseId: string }>
}) {
  const { tripId, expenseId } = await params
  const [t, { trip, items }, expenses] = await Promise.all([
    getTranslations(),
    loadTrip(tripId),
    serverApi(`/api/trips/${tripId}/expenses`, z.array(ExpenseDto)),
  ])
  const expense = expenses.find((e) => e.id === expenseId)
  if (!expense || trip.role === 'viewer') notFound()
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href={`/trips/${tripId}/expenses` as Route} label={t('expenses.title')} />
      </div>
      <PageHeader title={t('expenses.edit')} />
      <ExpenseForm trip={trip} items={items} expense={expense} defaultDay={expense.dayDate} />
    </>
  )
}
