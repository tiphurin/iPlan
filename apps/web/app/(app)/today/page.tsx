import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'

export default async function TodayPage() {
  const t = await getTranslations()
  return (
    <>
      <PageHeader title={t('today.title')} />
      <div className="px-4">
        <Card className="text-muted-foreground">{t('common.comingSoon')}</Card>
      </div>
    </>
  )
}
