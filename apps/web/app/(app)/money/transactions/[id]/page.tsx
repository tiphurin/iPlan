import { FinanceCategoryDto, MonthDto } from '@iplan/contracts'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { BackLink } from '@/components/back-link'
import { TransactionForm } from '@/components/money/transaction-form'
import { PageHeader } from '@/components/page-header'
import { serverApi } from '@/lib/server-api'
import { thisMonth, validMonth } from '@/lib/this-month'

export default async function TransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const [{ id }, { month: m }] = await Promise.all([params, searchParams])
  const [t, categories] = await Promise.all([
    getTranslations('finance'),
    serverApi('/api/finance/categories', z.array(FinanceCategoryDto)),
  ])
  // Look in the requested month first, then the previous 12 months.
  const start = validMonth(m) ?? thisMonth()
  let transaction
  for (let i = 0; i < 13 && !transaction; i++) {
    const [y, mo] = start.split('-').map(Number)
    const d = new Date(Date.UTC(y ?? 0, (mo ?? 1) - 1 - i, 1))
    const month = d.toISOString().slice(0, 7)
    transaction = (await serverApi(`/api/finance/months/${month}`, MonthDto)).transactions.find(
      (x) => x.id === id,
    )
  }
  if (!transaction) notFound()
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href="/money" label={t('title')} />
      </div>
      <PageHeader title={t('editTransaction')} />
      <TransactionForm
        categories={categories}
        transaction={transaction}
        defaultDate={transaction.date}
      />
    </>
  )
}
