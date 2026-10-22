import { ExpenseDto, PoolDto } from '@iplan/contracts'
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
  searchParams,
}: {
  params: Promise<{ tripId: string; expenseId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { tripId, expenseId } = await params
  const { from } = await searchParams
  const [t, { trip, items }, expenses, pool] = await Promise.all([
    getTranslations(),
    loadTrip(tripId),
    serverApi(`/api/trips/${tripId}/expenses`, z.array(ExpenseDto)),
    serverApi(`/api/trips/${tripId}/pool`, PoolDto),
  ])
  const expense = expenses.find((e) => e.id === expenseId)
  if (!expense || trip.role === 'viewer') notFound()
  // Opened from a plan item: back (and save/delete) go to that item, named in the back link.
  const place = from === 'item' ? items.find((i) => i.id === expense.itemId) : undefined
  const back = place
    ? { href: `/trips/${tripId}/items/${place.id}`, label: place.title }
    : { href: `/trips/${tripId}/expenses`, label: t('expenses.title') }
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink history href={back.href as Route} label={back.label} />
      </div>
      <PageHeader title={t('expenses.edit')} />
      <ExpenseForm
        trip={trip}
        items={items}
        expense={expense}
        defaultDay={expense.dayDate}
        returnTo={place ? back.href : undefined}
        poolLeftMinor={pool.leftoverBaseMinor}
      />
    </>
  )
}
