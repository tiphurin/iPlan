'use client'

import type { ExpenseDto, ExpenseSummaryDto, PoolDto, TripDetailDto } from '@iplan/contracts'
import { money, toDecimalString } from '@iplan/core'
import { CircleCheck, Landmark, Settings2, X } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { DayBars } from '@/components/charts/day-bars'
import { CATEGORY_COLORS, Donut } from '@/components/charts/donut'
import { PersonBars } from '@/components/charts/person-bars'
import { Button } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/chip'
import { Field, Input } from '@/components/ui/field'
import { Fab } from '@/components/ui/fab'
import { cn } from '@/lib/cn'
import { dayBars, personBars, settleCards, settleCount, viewerShare } from '@/lib/expense-charts'
import {
  fmt as fmtRaw,
  useExpenseMutations,
  useExpenseSummary,
  useExpenses,
  usePool,
} from '@/lib/expenses'
import { useShownMoney } from '@/lib/money-view'
import { TripDisplayProvider } from '@/lib/trip-display'
import { zoneCurrency } from '@/lib/time-zones'
import { MoneySwitch } from './display-switches'
import { useTrip } from '@/lib/trips'
import { PoolCard } from './pool-card'
import { SettleCards } from './settle-cards'
import { useFormat } from '@/lib/use-format'

interface ExpensesViewProps {
  initialTrip: TripDetailDto
  initialExpenses: ExpenseDto[]
  initialSummary: ExpenseSummaryDto
  initialPool: PoolDto
  /** The viewer, to show their own share of the total. */
  meId: string | null
  /** The trip's destination zone, whose currency the ₩ | ฿ switch offers. */
  away: string | null
}

/** Shares the plan's ₩ | ฿ choice (remembered per trip) with the cost pages. */
export function ExpensesView(props: ExpensesViewProps) {
  return (
    <TripDisplayProvider
      tripId={props.initialTrip.id}
      home={props.initialTrip.homeTimeZone}
      away={props.away}
    >
      <ExpensesBody {...props} />
    </TripDisplayProvider>
  )
}

function ExpensesBody({
  initialTrip,
  initialExpenses,
  initialSummary,
  initialPool,
  meId,
  away,
}: ExpensesViewProps) {
  const t = useTranslations()
  const f = useFormat()
  const { data: trip } = useTrip(initialTrip.id, initialTrip)
  const { data: expenses } = useExpenses(trip.id, initialExpenses)
  const { data: summary } = useExpenseSummary(trip.id, initialSummary)
  const { data: pool } = usePool(trip.id, initialPool)
  const mutations = useExpenseMutations(trip.id)
  const [showSettings, setShowSettings] = useState(false)
  const [newCurrency, setNewCurrency] = useState('')
  /** Rates taken out of the form; saving sends the full list, so they are deleted. */
  const [removed, setRemoved] = useState<string[]>([])
  const canEdit = trip.role !== 'viewer'
  const base = summary.baseCurrency
  const local = away ? zoneCurrency(away) : undefined
  // Totals follow the ₩ | ฿ switch; each expense still shows what was really paid.
  const shownMoney = useShownMoney(base, local, trip.fxRates)
  const fmt = shownMoney.fmt
  const maxDay = summary.byDay.reduce(
    (max, d) => Math.max(max, Number(d.spentMinor), Number(d.budgetMinor ?? 0)),
    1,
  )
  const days = [...new Set(expenses.map((e) => e.dayDate))].sort()
  const [tab, setTab] = useState<'list' | 'settle' | 'budget'>('list')
  const myShare = viewerShare(summary.parties, meId)
  const partyName = (id: string, name: string) => (id === 'pool' ? t('expenses.form.pool') : name)
  /** Member photo, or a bank icon for the shared pool. */
  const partyIcon = (id: string, name: string, size: number) =>
    id === 'pool' ? (
      <span
        aria-hidden
        className="flex items-center justify-center rounded-full bg-primary/10 text-primary"
        style={{ width: size, height: size }}
      >
        <Landmark className="size-[55%]" />
      </span>
    ) : (
      <Avatar
        name={name}
        image={trip.members.find((m) => m.userId === id)?.image ?? null}
        size={size}
      />
    )
  const steps = settleCount(summary)

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
      {
        onSuccess: () => {
          setShowSettings(false)
          setRemoved([])
        },
      },
    )
  }

  const currencies = [
    ...new Set([...Object.keys(trip.fxRates), ...(newCurrency ? [newCurrency] : [])]),
  ].filter((code) => !removed.includes(code))

  return (
    <div className="space-y-5 px-4">
      <Card className="border-primary/30 bg-primary/5">
        <p className="text-sm text-muted-foreground">{t('expenses.total')}</p>
        <p className="text-4xl font-bold tracking-tight tabular-nums">
          {fmt(summary.totalMinor, base)}
        </p>
        {myShare !== null && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {t('expenses.yourShare', { amount: fmt(myShare, base) })}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {local && local !== base && trip.fxRates[local] && (
            <MoneySwitch trip={trip} local={local} />
          )}
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
              <div key={code} className="flex items-end gap-2">
                <Field className="flex-1" label={t('expenses.rate', { code, base })}>
                  <Input
                    name={`rate:${code}`}
                    inputMode="decimal"
                    defaultValue={trip.fxRates[code] ?? ''}
                  />
                </Field>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('expenses.removeRate', { code })}
                  onClick={() => {
                    setRemoved((list) => [...list, code])
                    if (code === newCurrency) setNewCurrency('')
                  }}
                >
                  <X aria-hidden className="size-5" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                aria-label={t('expenses.addCurrency')}
                placeholder="KRW"
                maxLength={3}
                className="uppercase"
                onBlur={(e) => {
                  const code = e.target.value.trim().toUpperCase()
                  setNewCurrency(code)
                  setRemoved((list) => list.filter((c) => c !== code))
                }}
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

      <Segmented
        label={t('expenses.tabs.label')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'list', label: t('expenses.tabs.list') },
          { value: 'settle', label: t('expenses.tabs.settle') },
          { value: 'budget', label: t('expenses.tabs.budget') },
        ]}
      />

      {tab === 'list' && (
        <>
          <PoolCard trip={trip} pool={pool} meId={meId} show={fmt} />
          {expenses.length > 0 && (
            <section aria-label={t('expenses.charts.label')}>
              {/* Phones: a swipeable row of chart cards; md+: two columns. */}
              <div className="-mx-4 flex snap-x items-start md:items-stretch snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 [&>*]:w-[86%] [&>*]:shrink-0 [&>*]:snap-start md:[&>*]:w-auto">
                <Card>
                  <h3 className="mb-2 text-sm font-semibold">{t('expenses.charts.daily')}</h3>
                  <DayBars
                    bars={dayBars(summary.byDay).map((b) => ({
                      ...b,
                      detail: t(
                        b.budget === null
                          ? 'expenses.charts.dayDetail'
                          : b.over
                            ? 'expenses.charts.dayDetailOver'
                            : 'expenses.charts.dayDetailLeft',
                        {
                          day: f.day(b.key),
                          amount: fmt(BigInt(b.spent), base),
                          diff: fmt(BigInt(Math.abs((b.budget ?? 0) - b.spent)), base),
                        },
                      ),
                    }))}
                    labels={{
                      title: t('expenses.charts.daily'),
                      spent: t('expenses.charts.spent'),
                      budget: trip.dailyBudgetMinor
                        ? t('expenses.charts.budgetLine', {
                            amount: fmt(trip.dailyBudgetMinor, base),
                          })
                        : null,
                      over: t('expenses.charts.over'),
                      hint: t('expenses.charts.hint'),
                    }}
                  />
                </Card>
                {summary.byCategory.length > 0 && (
                  <Card>
                    <h3 className="mb-3 text-sm font-semibold">
                      {t('expenses.charts.categories')}
                    </h3>
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
                )}
                <Card className="md:col-span-2">
                  <h3 className="mb-3 text-sm font-semibold">{t('expenses.charts.people')}</h3>
                  <PersonBars
                    people={personBars(summary.parties).map((p) => ({
                      ...p,
                      name: partyName(p.id, p.name),
                      paidText: fmt(BigInt(p.paid), base),
                      shareText: fmt(BigInt(p.share), base),
                      netText:
                        p.net > 0
                          ? t('expenses.charts.getsBack', { amount: fmt(BigInt(p.net), base) })
                          : p.net < 0
                            ? t('expenses.charts.owes', { amount: fmt(BigInt(-p.net), base) })
                            : t('expenses.charts.even'),
                    }))}
                    labels={{
                      paid: t('expenses.charts.paid'),
                      share: t('expenses.charts.share'),
                    }}
                  />
                </Card>
              </div>
            </section>
          )}
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
                              {fmtRaw(e.amountMinor, e.currency)}
                            </span>
                            {e.currency !== shownMoney.shown && (
                              <span className="block text-xs text-muted-foreground">
                                {e.currency === base ? '≈ ' : ''}
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
        </>
      )}

      {tab === 'settle' && (
        <>
          <Card
            className={cn(
              'flex items-center gap-3',
              steps === 0 && 'border-success/40 bg-success/5',
            )}
          >
            {steps === 0 && <CircleCheck aria-hidden className="size-8 shrink-0 text-success" />}
            <p className="text-lg font-semibold">
              {steps === 0
                ? t('expenses.settled')
                : t('expenses.settleCards.steps', { count: steps })}
            </p>
          </Card>

          {(pool.contributions.length > 0 || BigInt(pool.spentBaseMinor) > 0n) && (
            <PoolCard trip={trip} pool={pool} meId={meId} show={fmt} compact />
          )}

          <SettleCards
            cards={settleCards(summary, meId)}
            meId={meId}
            t={t as unknown as (key: string, values?: Record<string, string | number>) => string}
            fmt={(minor) => fmt(minor, base)}
            icon={(id, name) => partyIcon(id, name, 26)}
          />
        </>
      )}

      {tab === 'budget' && (
        <>
          <Card className="space-y-1">
            {trip.dailyBudgetMinor ? (
              <p>{t('expenses.budgetIs', { amount: fmt(trip.dailyBudgetMinor, base) })}</p>
            ) : (
              <p className="text-muted-foreground">{t('expenses.noBudget')}</p>
            )}
            <p className="text-xs text-faint">{t('expenses.budgetHint')}</p>
          </Card>
          <section>
            <SectionTitle>{t('expenses.byDay')}</SectionTitle>
            <p className="mb-2 text-sm text-muted-foreground">
              {trip.dailyBudgetMinor
                ? t('expenses.budgetExplain', { amount: fmt(trip.dailyBudgetMinor, base) })
                : t('expenses.budgetExplainNone')}
            </p>
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
                            / {fmt(d.budgetMinor ?? '0', base)} ·{' '}
                            {over
                              ? t('expenses.overBy', {
                                  amount: fmt(
                                    BigInt(d.spentMinor) - BigInt(d.budgetMinor ?? '0'),
                                    base,
                                  ),
                                })
                              : t('expenses.left', {
                                  amount: fmt(
                                    BigInt(d.budgetMinor ?? '0') - BigInt(d.spentMinor),
                                    base,
                                  ),
                                })}
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
        </>
      )}

      {canEdit && (
        <Fab href={`/trips/${trip.id}/expenses/new` as Route} label={t('expenses.add')} />
      )}
    </div>
  )
}
