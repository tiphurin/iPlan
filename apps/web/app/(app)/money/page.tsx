import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'

export default async function MoneyPage() {
  const t = await getTranslations('money')
  return (
    <>
      <PageHeader title={t('title')} />
      <div className="px-4">
        <Card className="text-muted-foreground">{t('comingSoonBody')}</Card>
      </div>
    </>
  )
}
