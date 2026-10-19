import { AdminStatsDto } from '@iplan/contracts'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AdminView } from '@/components/admin/admin-view'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { getMe, serverApi } from '@/lib/server-api'

export default async function AdminPage() {
  const me = await getMe()
  // Non-admins get a plain 404; the API enforces the same rule.
  if (me?.role !== 'admin') notFound()
  const [t, stats] = await Promise.all([
    getTranslations(),
    serverApi('/api/admin/stats', AdminStatsDto),
  ])
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href="/settings" label={t('settings.title')} />
      </div>
      <PageHeader title={t('admin.title')} />
      <AdminView stats={stats} meId={me.id} />
    </>
  )
}
