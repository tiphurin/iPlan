'use client'

import type { ExpenseDto, ExpenseSummaryDto, TripDetailDto } from '@iplan/contracts'
import { money, toDecimalString } from '@iplan/core'
import { ArrowRight, Download, FileSpreadsheet, FileText, Plus, Settings2 } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { CATEGORY_COLORS, Donut } from '@/components/charts/donut'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { cn } from '@/lib/cn'
import { exportTripExcel } from '@/lib/excel'
import { fmt, useExpenseMutations, useExpenseSummary, useExpenses } from '@/lib/expenses'
import { useTrip } from '@/lib/trips'
import { useFormat } from '@/lib/use-format'

export function ExpensesView({
  initialTrip,
  initialExpenses,
  initialSummary,
}: {
  initialTrip: TripDetailDto
  initialExpenses: ExpenseDto[]
  initialSummary: ExpenseSummaryDto
}) {
  const t = useTranslations()
  const f = useFormat()
  const { data: trip } = useTrip(initialTrip.id, initialTrip)
  const { data: expenses } = useExpenses(trip.id, initialExpenses)
  const { data: summary } = useExpenseSummary(trip.id, initialSummary)
  const mutations = useExpenseMutations(trip.id)
  const [showSettings, setShowSettings] = useState(false)
  const [newCurrency, setNewCurrency] = useState('')
  const canEdit = trip.role !== 'viewer'
  const base = summary.baseCurrency
  const maxDay = summary.byDay.reduce(
    (max, d) => Math.max(max, Number(d.spentMinor), Number(d.budgetMinor ?? 0)),
    1,
  )
  const days = [...new Set(expenses.map((e) => e.dayDate))].sort()

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const fxRates: Record<string, string> = {}
    for (const [k, v] of form.entries()) {
      if (k.startsWith('rate:') && String(v).trim()) fxRates[k.slice(5)] = String(v).trim()
    }
    const budget = String(form.get('dailyBudget') ?? '').trim()
    mutations.settings.mutate(
      { fxRates, dailyBudget: budget || null },
      { onSuccess: () => setShowSettings(false) },
    )
  }

  const currencies = [
    ...new Set([...Object.keys(trip.fxRates), ...(newCurrency ? [newCurrency] : [])]),
  ]

  return (
    <div className="space-y-5 px-4">
      <Card className="border-primary/30 bg-primary/5">
        <p className="text-sm text-muted-foreground">{t('expenses.total')}</p>
        <p className="text-4xl font-bold tracking-tight tabular-nums">
          {fmt(summary.totalMinor, base)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`/api/trips/${trip.id}/expenses.csv`}
            className={buttonVariants({ variant: 'secondary' })}
          >
            <Download aria-hidden className="size-4" />
            {t('expenses.csv')}
          </a>
          <Button
            variant="secondary"
            onClick={() =>
              void exportTripExcel(trip.name, expenses, summary, trip.members, {
                expenses: t('expenses.title'),
                people: t('expenses.people'),
                settle: t('expenses.settle'),
                columns: {
                  date: t('export.col.date'),
                  title: t('export.col.title'),
                  category: t('export.col.category'),
                  amount: t('export.col.amount'),
                  currency: t('export.col.currency'),
                  rate: t('export.col.rate'),
                  base: t('export.col.base'),
                  paidBy: t('export.col.paidBy'),
                  split: t('export.col.split'),
                  name: t('export.col.name'),
                  paid: t('export.col.paid'),
                  share: t('export.col.share'),
                  net: t('export.col.net'),
                  from: t('export.col.from'),
                  to: t('export.col.to'),
                },
                category: (k) => t(`expenses.categories.${k}`),
                pool: t('expenses.form.pool'),
              })
            }
          >
            <FileSpreadsheet aria-hidden className="size-4" />
            {t('export.excel')}
          </Button>
          <Link
            href={`/print/trips/${trip.id}` as Route}
            className={buttonVariants({ variant: 'secondary' })}
          >
            <FileText aria-hidden className="size-4" />
            {t('export.pdf')}
          </Link>
          {canEdit && (
            <Button
              variant="secondary"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
            >
              <Settings2 aria-hidden className="size-4" />
              {t('expenses.settings')}
            </Button>
          )}
        </div>
      </Card>

      {showSettings && (
        <Card>
          <form onSubmit={saveSettings} className="space-y-3">
            {currencies.map((code) => (
              <Field key={code} label={t('expenses.rate', { code, base })}>
                <Input
                  name={`rate:${code}`}
                  inputMode="decimal"
                  defaultValue={trip.fxRates[code] ?? ''}
                />
              </Field>
            ))}
            <div className="flex gap-2">
              <Input
                aria-label={t('expenses.addCurrency')}
                placeholder="KRW"
                maxLength={3}
                className="uppercase"
                onBlur={(e) => setNewCurrency(e.target.value.trim().toUpperCase())}
              />
            </div>
            <Field label={t('expenses.dailyBudget', { base })}>
              <Input
                name="dailyBudget"
                inputMode="decimal"
                defaultValue={
                  trip.dailyBudgetMinor
                    ? toDecimalString(money(BigInt(trip.dailyBudgetMinor), base))
                    : ''
                }
              />
            </Field>
            <Button type="submit" size="lg" disabled={mutations.settings.isPending}>
              {t('expenses.saveSettings')}
            </Button>
          </form>
        </Card>
      )}

      <section>
        <SectionTitle>{t('expenses.settle')}</SectionTitle>
        <Card className="space-y-2">
          {summary.transfers.length === 0 ? (
            <p className="text-muted-foreground">{t('expenses.settled')}</p>
          ) : (
            summary.transfers.map((tr) => (
              <p key={`${tr.from}-${tr.to}`} className="flex items-center gap-2">
                <span className="font-medium">
                  {tr.from === 'pool' ? t('expenses.form.pool') : tr.fromName}
                </span>
                <ArrowRight
                  aria-label={t('expenses.pays')}
                  className="size-4 text-muted-foreground"
                />
                <span className="flex-1 font-medium">
                  {tr.to === 'pool' ? t('expenses.form.pool') : tr.toName}
                </span>
                <span className="font-semibold tabular-nums">{fmt(tr.amountMinor, base)}</span>
              </p>
            ))
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>{t('expenses.people')}</SectionTitle>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-[13px] tabular-nums [&_td:not(:first-child)]:whitespace-nowrap">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium" />
                <th className="px-2 py-2 text-right font-medium">{t('expenses.paid')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('expenses.share')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('expenses.net')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.parties.map((p) => {
                const net = BigInt(p.netMinor)
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-medium">
                      {p.id === 'pool' ? t('expenses.form.pool') : p.name}
                    </td>
                    <td className="px-2 py-2 text-right">{fmt(p.paidMinor, base)}</td>
                    <td className="px-2 py-2 text-right">{fmt(p.shareMinor, base)}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-semibold',
                        net > 0n ? 'text-success' : net < 0n ? 'text-danger' : '',
                      )}
                    >
                      {net > 0n ? '+' : ''}
                      {fmt(p.netMinor, base)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {summary.byCategory.length > 0 && (
        <section>
          <SectionTitle>{t('expenses.byCategory')}</SectionTitle>
          <Card>
            <Donut
              center={t('expenses.byCategory')}
              slices={summary.byCategory.map((c) => ({
                key: c.category,
                label: `${t(`expenses.categories.${c.category}`)} · ${fmt(c.spentMinor, base)}`,
                value: Number(c.spentMinor),
                color: CATEGORY_COLORS[c.category] ?? '#94a3b8',
              }))}
            />
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>{t('expenses.byDay')}</SectionTitle>
        <Card className="space-y-3">
          {summary.byDay.map((d) => {
            const spent = Number(d.spentMinor)
            const budget = d.budgetMinor === null ? null : Number(d.budgetMinor)
            const over = budget !== null && spent > budget
            return (
              <div key={d.dayDate}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{f.day(d.dayDate)}</span>
                  <span className={cn('tabular-nums', over && 'font-semibold text-danger')}>
                    {fmt(d.spentMinor, base)}
                    {budget !== null && (
                      <span className="text-muted-foreground">
                        {' '}
                        / {fmt(d.budgetMinor ?? '0', base)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', over ? 'bg-danger' : 'bg-primary')}
                    style={{ width: `${(spent / maxDay) * 100}%` }}
                  />
                  {budget !== null && (
                    <div
                      className="absolute -top-1 h-4 w-0.5 bg-foreground/60"
                      style={{ left: `${(budget / maxDay) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </Card>
      </section>

      <section className="space-y-4">
        {expenses.length === 0 && (
          <Card className="text-muted-foreground">{t('expenses.empty')}</Card>
        )}
        {days.map((day) => (
          <div key={day}>
            <SectionTitle>{f.day(day)}</SectionTitle>
            <ul className="divide-y rounded-2xl border bg-card">
              {expenses
                .filter((e) => e.dayDate === day)
                .map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/trips/${trip.id}/expenses/${e.id}` as Route}
                      className="flex items-center gap-3 px-4 py-3 active:bg-muted"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[e.category] }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t('expenses.form.paidBy')}:{' '}
                          {e.paidBy === 'pool' ? t('expenses.form.pool') : e.paidByName}
                        </span>
                      </span>
                      <span className="text-right tabular-nums">
                        <span className="block font-semibold">
                          {fmt(e.amountMinor, e.currency)}
                        </span>
                        {e.currency !== base && (
                          <span className="block text-xs text-muted-foreground">
                            {fmt(e.baseAmountMinor, base)}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      {canEdit && (
        <Link
          href={`/trips/${trip.id}/expenses/new` as Route}
          aria-label={t('expenses.add')}
          className={cn(
            buttonVariants({ size: 'icon' }),
            'fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg',
          )}
        >
          <Plus aria-hidden className="size-7" />
        </Link>
      )}
    </div>
  )
}
