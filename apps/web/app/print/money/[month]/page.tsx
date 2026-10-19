import { FinanceOverviewDto, MonthDto } from '@iplan/contracts'
import { type Month, addMonths } from '@iplan/core'
import { Donut } from '@/components/charts/donut'
import { TrendBars } from '@/components/charts/trend-bars'
import { type Locale, formatDayLabel, formatMonth } from '@iplan/i18n'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { PrintBar } from '@/components/print-button'
import { fmtServer } from '@/lib/money-format'
import { getMe, serverApi } from '@/lib/server-api'
import { validMonth } from '@/lib/this-month'

export const metadata: Metadata = { title: 'Print' }

const ROWS = [
  ['grossIncomeMinor', 'gross'],
  ['deductionsMinor', 'deductions'],
  ['netIncomeMinor', 'net'],
  ['fixedCostsMinor', 'fixed'],
  ['oneOffIncomeMinor', 'oneOff'],
  ['oneOffExpensesMinor', 'oneOff'],
  ['balanceMinor', 'balance'],
] as const

export default async function PrintMonthPage({ params }: { params: Promise<{ month: string }> }) {
  const month = validMonth((await params).month)
  if (!month) notFound()
  if (!(await getMe())) redirect(`/login?next=${encodeURIComponent(`/print/money/${month}`)}`)
  const [t, raw, data, overview] = await Promise.all([
    getTranslations(),
    getLocale(),
    serverApi(`/api/finance/months/${month}`, MonthDto),
    serverApi(
      `/api/finance/overview?from=${addMonths(month as Month, -5)}&to=${month}`,
      FinanceOverviewDto,
    ),
  ])
  const locale = raw as Locale
  const names = new Map(
    data.categories.map((c) => [
      c.id,
      c.name.startsWith('default:') ? t(`finance.defaultCategories.${c.name.slice(8)}`) : c.name,
    ]),
  )
  return (
    <>
      <PrintBar back={`/money?month=${month}`} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 text-[13px] leading-snug">
        <h1 className="text-2xl font-bold">
          {t('finance.title')} · {formatMonth(month, { locale })}
        </h1>
        <table className="w-full border-collapse tabular-nums">
          <tbody>
            {ROWS.map(([key, label], i) => (
              <tr key={key} className={i === ROWS.length - 1 ? 'border-t-2 font-bold' : 'border-b'}>
                <td className="py-1">
                  {t(`finance.${label}`)}
                  {key === 'oneOffIncomeMinor' && ` (${t('finance.tx.income')})`}
                  {key === 'oneOffExpensesMinor' && ` (${t('finance.tx.expense')})`}
                </td>
                <td className="py-1 text-right">{fmtServer(data.summary[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="grid grid-cols-2 gap-6 break-inside-avoid">
          <div>
            <h2 className="mb-1 text-lg font-semibold">{t('finance.trend')}</h2>
            <TrendBars
              points={overview.months.map((m) => ({
                key: m.month,
                label: formatMonth(m.month, { locale }).split(' ')[0] ?? m.month,
                income: Number(m.totalIncomeMinor),
                expense: Number(m.totalExpensesMinor),
                balance: Number(m.balanceMinor),
              }))}
              labels={{
                income: t('finance.totalIncome'),
                expense: t('finance.totalExpenses'),
                balance: t('finance.balance'),
              }}
              format={(v) => fmtServer(String(Math.round(v)))}
            />
          </div>
          {data.spendingByCategory.length > 0 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold">{t('finance.spending')}</h2>
              <Donut
                center={t('finance.spending')}
                slices={data.spendingByCategory.map((c) => {
                  const category = data.categories.find((x) => x.id === c.categoryId)
                  return {
                    key: c.categoryId ?? 'none',
                    label: `${(c.categoryId && names.get(c.categoryId)) || '—'} · ${fmtServer(c.spentMinor)}`,
                    value: Number(c.spentMinor),
                    color: category?.color ?? '#94a3b8',
                  }
                })}
              />
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-1 text-lg font-semibold">{t('finance.recurring')}</h2>
          <table className="w-full border-collapse tabular-nums">
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.ruleId} className="border-b">
                  <td className="py-1">
                    {line.name}
                    {line.overridden && (
                      <span className="text-muted-foreground"> · {t('finance.adjusted')}</span>
                    )}
                  </td>
                  <td className="py-1 text-right">{fmtServer(line.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="mb-1 text-lg font-semibold">{t('finance.oneOff')}</h2>
          <table className="w-full border-collapse tabular-nums">
            <tbody>
              {data.transactions.map((tx) => (
                <tr key={tx.id} className="border-b">
                  <td className="py-1 pr-2 whitespace-nowrap">
                    {formatDayLabel(tx.date, { locale })}
                  </td>
                  <td className="py-1">
                    {tx.title}
                    {tx.categoryId && (
                      <span className="text-muted-foreground"> · {names.get(tx.categoryId)}</span>
                    )}
                  </td>
                  <td className="py-1 text-right">
                    {tx.kind === 'expense' ? '−' : '+'}
                    {fmtServer(tx.amountMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  )
}
