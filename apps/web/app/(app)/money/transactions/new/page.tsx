import { FinanceCategoryDto } from '@iplan/contracts'
import { todayKey } from '@iplan/i18n'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { BackLink } from '@/components/back-link'
import { TransactionForm } from '@/components/money/transaction-form'
import { PageHeader } from '@/components/page-header'
import { serverApi } from '@/lib/server-api'

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date } = await searchParams
  const today = todayKey('Asia/Bangkok')
  // From a month view, default to today if it's that month, else the 1st of the month.
  const defaultDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? today.startsWith(date.slice(0, 7))
        ? today
        : date
      : today
  const [t, categories] = await Promise.all([
    getTranslations('finance'),
    serverApi('/api/finance/categories', z.array(FinanceCategoryDto)),
  ])
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href="/money" label={t('title')} />
      </div>
      <PageHeader title={t('addTransaction')} />
      <TransactionForm categories={categories} defaultDate={defaultDate} />
    </>
  )
}
