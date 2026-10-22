import { ExpenseDto, ExpenseSummaryDto, PoolDto, TripDetailDto } from '@iplan/contracts'
import { type Locale, formatDateRange, formatDayLabel, formatTime } from '@iplan/i18n'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { PrintBar } from '@/components/print-button'
import { cn } from '@/lib/cn'
import { loadTrip } from '@/lib/load-trip'
import { fmtServer } from '@/lib/money-format'
import { baseToLocal, usableRate } from '@/lib/money-convert'
import { DayBars } from '@/components/charts/day-bars'
import { CATEGORY_COLORS, Donut } from '@/components/charts/donut'
import { balanceRows, dayBars, personBars } from '@/lib/expense-charts'
import { BalanceBars } from '@/components/charts/balance-bars'
import { PersonBars } from '@/components/charts/person-bars'
import { getMe, serverApi } from '@/lib/server-api'
import { tripDays } from '@/lib/trip-dates'
import { zoneCity } from '@/lib/time-zones'

/** The page title is the trip name, so "Save as PDF" suggests it as the file name. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tripId: string }>
}): Promise<Metadata> {
  const { tripId } = await params
  try {
    const trip = await serverApi(`/api/trips/${tripId}`, TripDetailDto)
    return { title: { absolute: trip.name } }
  } catch {
    return { title: 'Print' }
  }
}

/** Print-friendly trip plan and expense summary; the browser saves it as PDF with correct Thai. */
export default async function PrintTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>
  searchParams: Promise<{ sections?: string; print?: string; lang?: string; currency?: string }>
}) {
  const { tripId } = await params
  const query = await searchParams
  // ?sections=plan,expenses picks the parts (both when missing); ?print=1 opens the print dialog.
  const parts = new Set((query.sections ?? 'plan,expenses').split(','))
  const showPlan = parts.has('plan') || !parts.has('expenses')
  const showExpenses = parts.has('expenses')
  if (!(await getMe())) redirect(`/login?next=${encodeURIComponent(`/print/trips/${tripId}`)}`)
  // ?lang=th|en is the export language, which may differ from the app's.
  const locale: Locale =
    query.lang === 'th' || query.lang === 'en' ? query.lang : ((await getLocale()) as Locale)
  const [t, { trip, items }, summary, pool, expenseList] = await Promise.all([
    getTranslations({ locale }),
    loadTrip(tripId),
    serverApi(`/api/trips/${tripId}/expenses/summary`, ExpenseSummaryDto),
    serverApi(`/api/trips/${tripId}/pool`, PoolDto),
    showExpenses
      ? serverApi(`/api/trips/${tripId}/expenses`, z.array(ExpenseDto))
      : Promise.resolve([]),
  ])
  const planDays = tripDays(trip.startDate, trip.endDate)
    .map((day, index) => ({ day, n: index + 1, list: items.filter((i) => i.dayDate === day) }))
    .filter((x) => x.list.length > 0)
  const expenseDays = [...new Set(expenseList.map((e) => e.dayDate))].sort()
  const hasPool = pool.contributions.length > 0 || BigInt(pool.spentBaseMinor) > 0n
  const left = BigInt(pool.leftoverBaseMinor)
  const netText = (net: number) =>
    net > 0
      ? t('expenses.charts.getsBack', { amount: fb(String(net)) })
      : net < 0
        ? t('expenses.charts.owes', { amount: fb(String(-net)) })
        : t('expenses.charts.even')
  const base = summary.baseCurrency
  // ?currency=KRW shows the totals in a currency the trip has a rate for; each expense keeps what was paid.
  const rate =
    query.currency && query.currency !== base ? usableRate(trip.fxRates, query.currency) : undefined
  const shown = rate && query.currency ? query.currency : base
  const fb = (minor: string | bigint) =>
    rate
      ? fmtServer(String(baseToLocal(BigInt(minor), base, shown, rate)), shown)
      : fmtServer(String(minor), base)
  const c = (k: string) => t(`export.col.${k}`)
  return (
    <>
      {/* Back returns to the screen that opened the export; opened directly, to the trip. */}
      <PrintBar back={`/trips/${tripId}`} autoPrint={query.print === '1'} />
      <main
        lang={locale}
        className="mx-auto max-w-2xl space-y-6 px-4 py-6 text-[15px] leading-normal"
      >
        <header>
          <h1 className="text-2xl font-bold">{trip.name}</h1>
          <p>
            {formatDateRange(trip.startDate, trip.endDate, { locale })}
            {trip.destination && ` · ${trip.destination}`}
          </p>
        </header>
        {showPlan && (
          <section className="space-y-4">
            {planDays.map(({ day, n, list }, d) => (
              <div key={day}>
                {list.map((item, i) => {
                  const row = (
                    <div className="grid grid-cols-[6.5rem_1fr] gap-2 border-b py-1.5">
                      <div className="whitespace-nowrap tabular-nums">
                        {formatTime(new Date(item.startsAt), item.timeZone)}
                        {item.endsAt &&
                          `–${formatTime(new Date(item.endsAt), item.details.arrivalTimeZone ?? item.timeZone)}`}
                        <div className="text-xs text-muted-foreground">
                          {zoneCity(item.timeZone)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <strong>{item.title}</strong>
                        <span className="text-muted-foreground"> · {t(`kinds.${item.kind}`)}</span>
                        {item.details.address && <div>{item.details.address}</div>}
                        {item.notes && (
                          <div className="whitespace-pre-line text-muted-foreground">
                            {item.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                  // Headings travel with the first row, so a page never ends on a lone title.
                  return (
                    <div key={item.id} className="break-inside-avoid">
                      {i === 0 && d === 0 && (
                        <h2 className="mb-3 text-lg font-semibold">{t('export.plan')}</h2>
                      )}
                      {i === 0 && (
                        <h3 className="mb-1 font-semibold">
                          {t('trips.dayN', { n })} · {formatDayLabel(day, { locale })}
                        </h3>
                      )}
                      {row}
                    </div>
                  )
                })}
              </div>
            ))}
          </section>
        )}
        {showExpenses && (
          // On paper the costs start on a new page after the plan (not when they are alone).
          <section className={cn('space-y-2', showPlan && 'break-before-page')}>
            <h2 className="text-lg font-semibold">
              {t('expenses.title')} · {fb(summary.totalMinor)}
            </h2>
            <table className="w-full border-collapse tabular-nums">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1">{c('name')}</th>
                  <th className="py-1 text-right">{c('paid')}</th>
                  <th className="py-1 text-right">{c('share')}</th>
                  <th className="py-1 text-right">{c('net')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.parties.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-1">{p.id === 'pool' ? t('expenses.form.pool') : p.name}</td>
                    <td className="py-1 text-right">{fb(p.paidMinor)}</td>
                    <td className="py-1 text-right">{fb(p.shareMinor)}</td>
                    <td className="py-1 text-right">{fb(p.netMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-6 pt-2">
              {summary.byCategory.length > 0 && (
                <div className="break-inside-avoid space-y-1.5">
                  <p className="font-semibold">{t('expenses.byCategory')}</p>
                  <Donut
                    center={t('expenses.byCategory')}
                    slices={summary.byCategory.map((x) => ({
                      key: x.category,
                      label: t(`expenses.categories.${x.category}`),
                      amount: fb(x.spentMinor),
                      value: Number(x.spentMinor),
                      color: CATEGORY_COLORS[x.category] ?? '#94a3b8',
                    }))}
                  />
                </div>
              )}
              <div className="max-w-md break-inside-avoid space-y-1.5">
                <p className="font-semibold">{t('expenses.charts.daily')}</p>
                <DayBars
                  static
                  bars={dayBars(summary.byDay).map((b) => ({
                    ...b,
                    detail: `${formatDayLabel(b.key, { locale })} · ${fb(String(b.spent))}${b.over ? ` · ${t('expenses.overBy', { amount: fb(String(b.spent - (b.budget ?? 0))) })}` : ''}`,
                  }))}
                  labels={{
                    title: t('expenses.charts.daily'),
                    spent: t('expenses.charts.spent'),
                    budget: trip.dailyBudgetMinor
                      ? t('expenses.charts.budgetLine', {
                          amount: fb(trip.dailyBudgetMinor),
                        })
                      : null,
                    over: t('expenses.charts.over'),
                    hint: '',
                  }}
                />
              </div>
            </div>
            {hasPool && (
              <div className="break-inside-avoid space-y-1.5 pt-2">
                <p className="font-semibold">
                  {t('expenses.pool.title')} · {t(`expenses.pool.modes.${pool.mode}`)}
                </p>
                <p>
                  {t('expenses.pool.putIn')} {fb(pool.totalBaseMinor)} · {t('expenses.pool.spent')}{' '}
                  {fb(pool.spentBaseMinor)} ·{' '}
                  {left >= 0n
                    ? t('expenses.pool.leftAmount', { amount: fb(String(left)) })
                    : t('expenses.pool.shortAmount', { amount: fb(String(-left)) })}
                </p>
                {pool.contributions.length > 0 && (
                  <table className="w-full border-collapse tabular-nums">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-1">{c('date')}</th>
                        <th className="py-1">{c('name')}</th>
                        <th className="py-1 text-right">{c('amount')}</th>
                        <th className="py-1 pr-3 text-right">{base}</th>
                        <th className="py-1">{c('note')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pool.contributions.map((x) => (
                        <tr key={x.id} className="border-b">
                          <td className="py-1">{formatDayLabel(x.date, { locale })}</td>
                          <td className="py-1">{x.name}</td>
                          <td className="py-1 text-right">
                            {fmtServer(x.amountMinor, x.currency)}
                          </td>
                          <td className="py-1 pr-3 text-right">
                            {fmtServer(x.baseAmountMinor, base)}
                          </td>
                          <td className="py-1">{x.note ?? ''}</td>
                        </tr>
                      ))}
                      {pool.byMember.map((m) => (
                        <tr key={m.userId} className="border-b font-semibold">
                          <td className="py-1" />
                          <td className="py-1">{m.name}</td>
                          <td className="py-1 text-right">{(m.percentBp / 100).toFixed(1)}%</td>
                          <td className="py-1 text-right">{fb(m.contributedBaseMinor)}</td>
                          <td className="py-1" />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {summary.transfers.map((tr) => (
              <p key={`${tr.from}-${tr.to}`}>
                {tr.from === 'pool' ? t('expenses.form.pool') : tr.fromName} →{' '}
                {tr.to === 'pool' ? t('expenses.form.pool') : tr.toName}:{' '}
                <strong>{fb(tr.amountMinor)}</strong>
              </p>
            ))}
            <div className="space-y-6 pt-3">
              <div className="break-inside-avoid space-y-1.5">
                <p className="font-semibold">{t('expenses.charts.people')}</p>
                <PersonBars
                  people={personBars(summary.parties).map((p) => ({
                    ...p,
                    name: p.id === 'pool' ? t('expenses.form.pool') : p.name,
                    paidText: fb(String(p.paid)),
                    shareText: fb(String(p.share)),
                    netText: netText(p.net),
                  }))}
                  labels={{ paid: t('expenses.charts.paid'), share: t('expenses.charts.share') }}
                />
              </div>
              <div className="break-inside-avoid space-y-1.5">
                <p className="font-semibold">{t('expenses.settleView.balances')}</p>
                <BalanceBars
                  rows={balanceRows(summary.parties).map((r) => ({
                    ...r,
                    name: r.isPool ? t('expenses.form.pool') : r.name,
                    icon: null,
                    netText: netText(r.net),
                    detail: '',
                  }))}
                  labels={{
                    owes: t('expenses.settleView.owes'),
                    getsBack: t('expenses.settleView.getsBack'),
                  }}
                />
              </div>
            </div>
            {expenseDays.length > 0 && (
              <div className="space-y-4 pt-3">
                {expenseDays.map((day, d) => (
                  <div key={day}>
                    {expenseList
                      .filter((e) => e.dayDate === day)
                      .map((e, i) => (
                        // Headings travel with the first expense of the day.
                        <div key={e.id} className="break-inside-avoid">
                          {i === 0 && d === 0 && (
                            <p className="mb-3 font-semibold">{t('expenses.byDayList')}</p>
                          )}
                          {i === 0 && (
                            <h3 className="mb-1 font-semibold">
                              {formatDayLabel(day, { locale })}
                            </h3>
                          )}
                          <div className="flex items-start gap-3 border-b py-2">
                            <span
                              className="mt-1.5 size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: CATEGORY_COLORS[e.category] }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium">{e.title}</span>
                              <span className="block text-sm text-muted-foreground">
                                {t(`expenses.categories.${e.category}`)} ·{' '}
                                {t('expenses.form.paidBy')}:{' '}
                                {e.paidBy === 'pool' ? t('expenses.form.pool') : e.paidByName}
                              </span>
                            </span>
                            <span className="text-right tabular-nums">
                              <span className="block font-semibold">
                                {fmtServer(e.amountMinor, e.currency)}
                              </span>
                              {e.currency !== base && (
                                <span className="block text-sm text-muted-foreground">
                                  {fmtServer(e.baseAmountMinor, base)}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </>
  )
}
