import { FinanceCategoryDto, RecurringRuleDto } from '@iplan/contracts'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { BackLink } from '@/components/back-link'
import { RulesView } from '@/components/money/rules-view'
import { PageHeader } from '@/components/page-header'
import { serverApi } from '@/lib/server-api'
import { thisMonth } from '@/lib/this-month'

export default async function RulesPage() {
  const [t, rules, categories] = await Promise.all([
    getTranslations('finance'),
    serverApi('/api/finance/rules', z.array(RecurringRuleDto)),
    serverApi('/api/finance/categories', z.array(FinanceCategoryDto)),
  ])
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href="/money" label={t('title')} />
      </div>
      <PageHeader title={t('recurring')} />
      <RulesView initialRules={rules} initialCategories={categories} thisMonth={thisMonth()} />
    </>
  )
}
