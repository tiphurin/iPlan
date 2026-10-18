import { InviteDto } from '@iplan/contracts'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { MembersView } from '@/components/trips/members-view'
import { loadTrip } from '@/lib/load-trip'
import { getMe, serverApi } from '@/lib/server-api'

export default async function MembersPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const [t, { trip }, me] = await Promise.all([getTranslations(), loadTrip(tripId), getMe()])
  if (!me) redirect('/login')
  const invites =
    trip.role === 'viewer'
      ? []
      : await serverApi(`/api/trips/${tripId}/invites`, z.array(InviteDto))
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href={`/trips/${tripId}` as Route} label={trip.name} />
      </div>
      <PageHeader title={t('members.title')} />
      <MembersView trip={trip} initialInvites={invites} meId={me.id} />
    </>
  )
}
