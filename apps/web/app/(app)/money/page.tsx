import { MonthDto } from '@iplan/contracts'
import { getTranslations } from 'next-intl/server'
import { MoneyView } from '@/components/money/money-view'
import { PageHeader } from '@/components/page-header'
import { serverApi } from '@/lib/server-api'
import { thisMonth, validMonth } from '@/lib/this-month'

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const month = validMonth((await searchParams).month) ?? thisMonth()
  const [t, data] = await Promise.all([
    getTranslations('finance'),
    serverApi(`/api/finance/months/${month}`, MonthDto),
  ])
  return (
    <>
      <PageHeader title={t('title')} />
      <MoneyView key={month} month={month} initial={data} />
    </>
  )
}
