import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TripView } from '@/components/trips/trip-view'
import { loadTrip } from '@/lib/load-trip'
import { ExpenseDto } from '@iplan/contracts'
import { z } from 'zod'
import { getMe, requestTime, serverApi } from '@/lib/server-api'

interface Props {
  params: Promise<{ tripId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { trip } = await loadTrip((await params).tripId)
  return { title: trip.name }
}

export default async function TripPage({ params }: Props) {
  const { tripId } = await params
  const [{ trip, items }, me, expenses] = await Promise.all([
    loadTrip(tripId),
    getMe(),
    serverApi(`/api/trips/${tripId}/expenses`, z.array(ExpenseDto)).catch(() => []),
  ])
  if (!me) redirect('/login')
  return (
    <TripView
      initialTrip={trip}
      initialItems={items}
      initialExpenses={expenses}
      meId={me.id}
      serverNow={requestTime()}
    />
  )
}
