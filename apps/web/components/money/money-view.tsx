'use client'

import { FinanceOverviewDto, type MonthDto, type MonthLineDto } from '@iplan/contracts'
import { type Month, addMonths } from '@iplan/core'
import { formatMonth, todayKey } from '@iplan/i18n'
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Repeat, Tags } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Donut } from '@/components/charts/donut'
import { TrendBars } from '@/components/charts/trend-bars'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, Hero, SectionTitle } from '@/components/ui/card'
import { type DayMark, MonthCalendar } from '@/components/ui/month-calendar'
import { Progress } from '@/components/ui/progress'
import { Fab } from '@/components/ui/fab'
import { cn } from '@/lib/cn'
import { exportMonthExcel } from '@/lib/excel'
import { fmt } from '@/lib/expenses'
import { useCategoryName, useMonth } from '@/lib/finance'
import { useFormat } from '@/lib/use-format'
import { AdjustSheet } from './adjust-sheet'

const THB = 'THB'

export function MoneyView({ month, initial }: { month: string; initial: MonthDto }) {
  const t = useTranslations('finance')
  const tAll = useTranslations()
  const f = useFormat()
  const router = useRouter()
  const categoryName = useCategoryName()
  const { data } = useMonth(month, initial)
  const [adjusting, setAdjusting] = useState<MonthLineDto | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const from = addMonths(month as Month, -5)
  const { data: overview } = useQuery({
    queryKey: ['finance', 'overview', from, month],
    queryFn: () =>
      apiFetch(`/api/finance/overview?from=${from}&to=${month}`, { schema: FinanceOverviewDto }),
  })
  const s = data.summary
  const go = (delta: number) =>
    router.push(`/money?month=${addMonths(month as Month, delta)}` as Route)
  const categories = new Map(data.categories.map((c) => [c.id, c]))
  const income = Number(s.totalIncomeMinor)
  const spending = Number(s.totalExpensesMinor)
  const scale = Math.max(income, spending, 1)

  const visibleTx = selectedDay
    ? data.transactions.filter((tx) => tx.date === selectedDay)
    : data.transactions
  // Each day with one-off spending shows a dot per category and the day's total.
  const dayMarks: Record<string, DayMark> = {}
  for (const tx of data.transactions) {
    if (tx.kind !== 'expense') continue
    const mark = (dayMarks[tx.date] ??= { dots: [] })
    const color = (tx.categoryId && categories.get(tx.categoryId)?.color) || '#94a3b8'
    if (!mark.dots?.includes(color)) mark.dots?.push(color)
  }

  const lines = (kind: MonthLineDto['kind']) => data.lines.filter((l) => l.kind === kind)
  const section = (kind: MonthLineDto['kind'], title: string) => (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <ul className="divide-y rounded-2xl border bg-card">
        {lines(kind).length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">{t('noLines')}</li>
        )}
        {lines(kind).map((line) => (
          <li key={line.ruleId}>
            <button
              type="button"
              onClick={() => setAdjusting(line)}
              className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{line.name}</span>
                {line.overridden && (
                  <span className="block text-xs text-warning">
                    {t('adjusted')} · {t('planned', { amount: fmt(line.plannedMinor, THB) })}
                    {line.note && ` · ${line.note}`}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  kind === 'income' ? 'text-success' : '',
                )}
              >
                {kind === 'income' ? '' : '−'}
                {fmt(line.amountMinor, THB)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <div className="space-y-5 px-4">
      <div className="flex items-center justify-between rounded-full border bg-card p-1">
        <Button variant="ghost" size="icon" aria-label={t('prevMonth')} onClick={() => go(-1)}>
          <ChevronLeft aria-hidden className="size-6" />
        </Button>
        <p className="font-display text-lg font-semibold">
          {formatMonth(month, { locale: f.locale })}
        </p>
        <Button variant="ghost" size="icon" aria-label={t('nextMonth')} onClick={() => go(1)}>
          <ChevronRight aria-hidden className="size-6" />
        </Button>
      </div>

      <div className="space-y-5 md:grid md:grid-cols-2 md:items-start md:gap-6 md:space-y-0">
        <div className="space-y-5">
          <Hero tone="ink">
            <p className="text-sm text-muted-foreground">{t('balance')}</p>
            <p
              className={cn(
                'my-1 font-display text-[36px] leading-none font-bold tabular-nums',
                BigInt(s.balanceMinor) < 0n && 'text-danger',
              )}
            >
              {fmt(s.balanceMinor, THB)}
            </p>
            <div className="mt-4 space-y-3">
              {(
                [
                  ['totalIncome', income, s.totalIncomeMinor, 'var(--success)'],
                  ['totalExpenses', spending, s.totalExpensesMinor, 'var(--danger)'],
                ] as const
              ).map(([key, value, minor, color]) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">{t(key)}</span>
                    <span className="num">{fmt(minor, THB)}</span>
                  </div>
                  <div className="h-[9px] rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(value / scale) * 100}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t('gross')} {fmt(s.grossIncomeMinor, THB)} − {t('deductions')}{' '}
              {fmt(s.deductionsMinor, THB)} = {t('net')} {fmt(s.netIncomeMinor, THB)}
            </p>
          </Hero>

          <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            <Link
              href="/money/rules"
              className={cn(buttonVariants({ variant: 'secondary' }), 'shrink-0')}
            >
              <Repeat aria-hidden className="size-4" />
              {t('recurring')}
            </Link>
            <Button
              variant="secondary"
              className="shrink-0"
              onClick={() =>
                void exportMonthExcel(data, {
                  summary: t('balance'),
                  lines: t('recurring'),
                  oneOff: t('oneOff'),
                  rows: [
                    { key: 'grossIncomeMinor', label: t('gross') },
                    { key: 'deductionsMinor', label: t('deductions') },
                    { key: 'netIncomeMinor', label: t('net') },
                    { key: 'fixedCostsMinor', label: t('fixed') },
                    { key: 'oneOffIncomeMinor', label: `${t('oneOff')} (${t('tx.income')})` },
                    { key: 'oneOffExpensesMinor', label: `${t('oneOff')} (${t('tx.expense')})` },
                    { key: 'balanceMinor', label: t('balance') },
                  ],
                  columns: {
                    type: tAll('export.col.type'),
                    name: tAll('export.col.name'),
                    planned: tAll('export.col.planned'),
                    amount: tAll('export.col.amount'),
                    adjusted: tAll('export.col.adjusted'),
                    date: tAll('export.col.date'),
                    title: tAll('export.col.title'),
                    category: tAll('export.col.category'),
                    note: tAll('export.col.note'),
                  },
                  kind: (k) =>
                    ({
                      income: t('income'),
                      deduction: t('deductions'),
                      fixed: t('fixed'),
                      expense: t('tx.expense'),
                    })[k] ?? k,
                  category: (id) => {
                    const c = id ? categories.get(id) : undefined
                    return c ? categoryName(c.name) : ''
                  },
                })
              }
            >
              <FileSpreadsheet aria-hidden className="size-4" />
              {tAll('export.excel')}
            </Button>
            <Link
              href={`/print/money/${month}` as Route}
              className={cn(buttonVariants({ variant: 'secondary' }), 'shrink-0')}
            >
              <FileText aria-hidden className="size-4" />
              {tAll('export.pdf')}
            </Link>
            <Link
              href="/money/categories"
              className={cn(buttonVariants({ variant: 'secondary' }), 'shrink-0')}
            >
              <Tags aria-hidden className="size-4" />
              {t('categories')}
            </Link>
          </nav>

          {data.lines.length > 0 ? (
            <>
              {section('income', t('income'))}
              {section('deduction', t('deductions'))}
              {section('fixed', t('fixed'))}
            </>
          ) : (
            <Link
              href="/money/rules"
              className="flex items-center gap-3 rounded-2xl border border-dashed bg-card p-4 active:bg-muted"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-l1 text-white">
                <Repeat aria-hidden className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{t('setupTitle')}</span>
                <span className="block text-sm text-muted-foreground">{t('setupHint')}</span>
              </span>
            </Link>
          )}
          {data.budgets.length > 0 && (
            <section>
              <SectionTitle>{t('budgets')}</SectionTitle>
              <Card className="space-y-3">
                {data.budgets.map((b) => {
                  const category = categories.get(b.categoryId)
                  return (
                    <div key={b.categoryId}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{category ? categoryName(category.name) : ''}</span>
                        <span
                          className={cn(
                            'tabular-nums',
                            b.status === 'over' && 'font-semibold text-danger',
                            b.status === 'warning' && 'text-warning',
                          )}
                        >
                          {fmt(b.spentMinor, THB)} / {fmt(b.limitMinor, THB)}
                        </span>
                      </div>
                      <Progress
                        value={b.ratio}
                        className={cn(
                          b.status === 'over' && '[&>div]:bg-danger',
                          b.status === 'warning' && '[&>div]:bg-warning',
                        )}
                      />
                    </div>
                  )
                })}
              </Card>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <MonthCalendar
            month={month}
            onMonthChange={(m) => router.push(`/money?month=${m}` as Route)}
            selected={selectedDay}
            onSelect={(d) => setSelectedDay((cur) => (cur === d ? null : d))}
            today={todayKey('Asia/Bangkok')}
            marks={dayMarks}
          />
          <section>
            <SectionTitle
              action={
                selectedDay ? (
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="min-h-11 px-2 text-sm font-medium text-primary"
                  >
                    {t('allDays')}
                  </button>
                ) : undefined
              }
            >
              {selectedDay ? f.day(selectedDay) : t('oneOff')}
            </SectionTitle>
            <ul className="divide-y rounded-2xl border bg-card">
              {visibleTx.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted-foreground">{t('noLines')}</li>
              )}
              {visibleTx.map((tx) => {
                const category = tx.categoryId ? categories.get(tx.categoryId) : undefined
                return (
                  <li key={tx.id}>
                    <Link
                      href={`/money/transactions/${tx.id}` as Route}
                      className="flex min-h-12 items-center gap-3 px-4 py-2 active:bg-muted"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: category?.color ?? '#94a3b8' }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{tx.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {f.day(tx.date)}
                          {category && ` · ${categoryName(category.name)}`}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'font-semibold tabular-nums',
                          tx.kind === 'income' && 'text-success',
                        )}
                      >
                        {tx.kind === 'income' ? '+' : '−'}
                        {fmt(tx.amountMinor, THB)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          {overview && (
            <section>
              <SectionTitle>{t('trend')}</SectionTitle>
              <Card>
                <TrendBars
                  points={overview.months.map((m) => ({
                    key: m.month,
                    label: formatMonth(m.month, { locale: f.locale }).split(' ')[0] ?? m.month,
                    income: Number(m.totalIncomeMinor),
                    expense: Number(m.totalExpensesMinor),
                    balance: Number(m.balanceMinor),
                  }))}
                  labels={{
                    income: t('totalIncome'),
                    expense: t('totalExpenses'),
                    balance: t('balance'),
                  }}
                  format={(v) => fmt(BigInt(Math.round(v)), THB)}
                />
              </Card>
            </section>
          )}

          {data.spendingByCategory.length > 0 && (
            <section>
              <SectionTitle>{t('spending')}</SectionTitle>
              <Card>
                <Donut
                  center={t('spending')}
                  slices={data.spendingByCategory.map((c) => {
                    const category = c.categoryId ? categories.get(c.categoryId) : undefined
                    return {
                      key: c.categoryId ?? 'none',
                      label: `${category ? categoryName(category.name) : '—'} · ${fmt(c.spentMinor, THB)}`,
                      value: Number(c.spentMinor),
                      color: category?.color ?? '#94a3b8',
                    }
                  })}
                />
              </Card>
            </section>
          )}
        </div>
      </div>

      <Fab href={`/money/transactions/new?date=${month}-01` as Route} label={t('addTransaction')} />

      {adjusting && (
        <AdjustSheet line={adjusting} month={month} onClose={() => setAdjusting(null)} />
      )}
    </div>
  )
}
