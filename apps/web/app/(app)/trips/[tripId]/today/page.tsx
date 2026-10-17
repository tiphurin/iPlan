import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { TodayView } from '@/components/trips/today-view'
import { loadTrip } from '@/lib/load-trip'
import { getMe, requestTime } from '@/lib/server-api'

export default async function TripTodayPage({ params }: { params: Promise<{ tripId: string }> }) {
  await connection()
  const { tripId } = await params
  const [{ trip, items }, me] = await Promise.all([loadTrip(tripId), getMe()])
  if (!me) redirect('/login')
  return (
    <TodayView initialTrip={trip} initialItems={items} meId={me.id} serverNow={requestTime()} />
  )
}
