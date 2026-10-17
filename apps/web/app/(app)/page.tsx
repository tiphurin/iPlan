import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { getMe } from '@/lib/server-api'

export default async function TripsPage() {
  const [t, me] = await Promise.all([getTranslations(), getMe()])
  return (
    <>
      <PageHeader title={t('nav.trips')} subtitle={t('home.greeting', { name: me?.name ?? '' })} />
      <div className="px-4">
        <Card className="text-muted-foreground">{t('common.comingSoon')}</Card>
      </div>
    </>
  )
}
