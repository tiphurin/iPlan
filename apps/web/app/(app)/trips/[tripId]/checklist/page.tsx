import { ChecklistItemDto } from '@iplan/contracts'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { ChecklistView } from '@/components/trips/checklist-view'
import { loadTrip } from '@/lib/load-trip'
import { getMe, serverApi } from '@/lib/server-api'

export default async function ChecklistPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const [t, { trip }, me, items] = await Promise.all([
    getTranslations(),
    loadTrip(tripId),
    getMe(),
    serverApi(`/api/trips/${tripId}/checklist`, z.array(ChecklistItemDto)),
  ])
  if (!me) redirect('/login')
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href={`/trips/${tripId}` as Route} label={trip.name} />
      </div>
      <PageHeader title={t('checklist.title')} />
      <ChecklistView trip={trip} initialItems={items} meId={me.id} />
    </>
  )
}
