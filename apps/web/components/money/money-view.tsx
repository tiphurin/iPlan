'use client'

import type { MonthDto, MonthLineDto } from '@iplan/contracts'
import { type Month, addMonths } from '@iplan/core'
import { formatMonth } from '@iplan/i18n'
import { ChevronLeft, ChevronRight, Plus, Repeat, Tags } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Donut } from '@/components/charts/donut'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/expenses'
import { useCategoryName, useMonth } from '@/lib/finance'
import { useFormat } from '@/lib/use-format'
import { AdjustSheet } from './adjust-sheet'

const THB = 'THB'

export function MoneyView({ month, initial }: { month: string; initial: MonthDto }) {
  const t = useTranslations('finance')
  const f = useFormat()
  const router = useRouter()
  const categoryName = useCategoryName()
  const { data } = useMonth(month, initial)
  const [adjusting, setAdjusting] = useState<MonthLineDto | null>(null)
  const s = data.summary
  const go = (delta: number) =>
    router.push(`/money?month=${addMonths(month as Month, delta)}` as Route)
  const categories = new Map(data.categories.map((c) => [c.id, c]))
  const income = Number(s.totalIncomeMinor)
  const spending = Number(s.totalExpensesMinor)
  const scale = Math.max(income, spending, 1)

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
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label={t('prevMonth')} onClick={() => go(-1)}>
          <ChevronLeft aria-hidden className="size-6" />
        </Button>
        <p className="text-lg font-semibold">{formatMonth(month, { locale: f.locale })}</p>
        <Button variant="ghost" size="icon" aria-label={t('nextMonth')} onClick={() => go(1)}>
          <ChevronRight aria-hidden className="size-6" />
        </Button>
      </div>

      <Card className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">{t('balance')}</p>
          <p
            className={cn(
              'text-4xl font-bold tracking-tight tabular-nums',
              BigInt(s.balanceMinor) < 0n && 'text-danger',
            )}
          >
            {fmt(s.balanceMinor, THB)}
          </p>
        </div>
        {(
          [
            ['totalIncome', income, s.totalIncomeMinor, 'bg-success'],
            ['totalExpenses', spending, s.totalExpensesMinor, 'bg-danger'],
          ] as const
        ).map(([key, value, minor, color]) => (
          <div key={key}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{t(key)}</span>
              <span className="font-semibold tabular-nums">{fmt(minor, THB)}</span>
            </div>
            <div className="h-3 rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', color)}
                style={{ width: `${(value / scale) * 100}%` }}
              />
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          {t('gross')} {fmt(s.grossIncomeMinor, THB)} − {t('deductions')}{' '}
          {fmt(s.deductionsMinor, THB)} = {t('net')} {fmt(s.netIncomeMinor, THB)}
        </p>
      </Card>

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <Link
          href="/money/rules"
          className={cn(buttonVariants({ variant: 'secondary' }), 'shrink-0')}
        >
          <Repeat aria-hidden className="size-4" />
          {t('recurring')}
        </Link>
        <Link
          href="/money/categories"
          className={cn(buttonVariants({ variant: 'secondary' }), 'shrink-0')}
        >
          <Tags aria-hidden className="size-4" />
          {t('categories')}
        </Link>
      </nav>

      {section('income', t('income'))}
      {section('deduction', t('deductions'))}
      {section('fixed', t('fixed'))}

      <section>
        <SectionTitle>{t('oneOff')}</SectionTitle>
        <ul className="divide-y rounded-2xl border bg-card">
          {data.transactions.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">{t('noLines')}</li>
          )}
          {data.transactions.map((tx) => {
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

      <Link
        href={`/money/transactions/new?date=${month}-01` as Route}
        aria-label={t('addTransaction')}
        className={cn(
          buttonVariants({ size: 'icon' }),
          'fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg',
        )}
      >
        <Plus aria-hidden className="size-7" />
      </Link>

      {adjusting && (
        <AdjustSheet line={adjusting} month={month} onClose={() => setAdjusting(null)} />
      )}
    </div>
  )
}
