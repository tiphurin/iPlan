import { FinanceCategoryDto } from '@iplan/contracts'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { BackLink } from '@/components/back-link'
import { CategoriesView } from '@/components/money/categories-view'
import { PageHeader } from '@/components/page-header'
import { serverApi } from '@/lib/server-api'

export default async function CategoriesPage() {
  const [t, categories] = await Promise.all([
    getTranslations('finance'),
    serverApi('/api/finance/categories', z.array(FinanceCategoryDto)),
  ])
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href="/money" label={t('title')} />
      </div>
      <PageHeader title={t('categories')} />
      <CategoriesView initial={categories} />
    </>
  )
}
