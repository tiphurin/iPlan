import {
  type FeatureKey,
  FinanceOverviewDto,
  LedgerDto,
  MonthDto,
  TripDto,
  TripItemDto,
} from '@iplan/contracts'
import { type Locale, formatTime, todayKey } from '@iplan/i18n'
import { ArrowRight, Plus } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { ComponentType } from 'react'
import { z } from 'zod'
import { Hero } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { addMonths } from '@/lib/month-grid'
import { fmtServer } from '@/lib/money-format'
import { requestTime, serverApi } from '@/lib/server-api'
import { thisMonth } from '@/lib/this-month'
import { daysBetween } from '@/lib/trip-color'
import { tripPhase } from '@/lib/trip-dates'

type Widget = ComponentType<{ locale: Locale }>

/** Trips: the trip happening now (with what's next) or the next one coming up. */
async function TripsWidget({ locale }: { locale: Locale }) {
  const [t, trips] = await Promise.all([
    getTranslations('dashboard'),
    serverApi('/api/trips', z.array(TripDto)),
  ])
  const phase = (trip: TripDto) => tripPhase(trip, todayKey(trip.homeTimeZone))
  const ongoing = trips.find((trip) => phase(trip) === 'ongoing')
  const next = trips
    .filter((trip) => phase(trip) === 'upcoming')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]

  if (ongoing) {
    const items = await serverApi(`/api/trips/${ongoing.id}/items`, z.array(TripItemDto))
    const now = requestTime()
    const upcoming = items.find((i) => Date.parse(i.startsAt) > now)
    const today = todayKey(ongoing.homeTimeZone)
    return (
      <Link href={`/trips/${ongoing.id}/today` as Route} className="block active:opacity-90">
        <Hero tone="green">
          <p className="text-sm opacity-90">
            {t('onTrip')} · {t('dayN', { n: daysBetween(ongoing.startDate, today) + 1 })}
          </p>
          <p className="my-1 font-display text-[28px] leading-tight font-bold">{ongoing.name}</p>
          {upcoming && (
            <p className="text-[15px] opacity-95">
              {t('next')}: {formatTime(new Date(upcoming.startsAt), upcoming.timeZone, { locale })}{' '}
              {upcoming.title}
            </p>
          )}
          <span className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 font-semibold text-[#00873e]">
            {t('openToday')}
            <ArrowRight aria-hidden className="size-4" />
          </span>
        </Hero>
      </Link>
    )
  }

  if (next) {
    const days = daysBetween(todayKey(next.homeTimeZone), next.startDate)
    return (
      <Link href={`/trips/${next.id}` as Route} className="block active:opacity-90">
        <Hero tone="sky">
          <p className="text-sm opacity-90">{t('nextTrip')}</p>
          <p className="my-1 font-display text-[32px] leading-none font-bold">
            {t('inDays', { count: days })}
          </p>
          <p className="text-[15px] opacity-95">
            {next.name}
            {next.destination && ` · ${next.destination}`}
          </p>
        </Hero>
      </Link>
    )
  }

  return (
    <Link
      href="/trips/new"
      className="flex min-h-[88px] items-center gap-3 rounded-2xl border border-dashed bg-card px-4 active:bg-muted"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-[#00a84d] text-white">
        <Plus aria-hidden className="size-6" />
      </span>
      <span>
        <span className="block font-semibold">{t('planTrip')}</span>
        <span className="block text-sm text-muted-foreground">{t('planTripHint')}</span>
      </span>
    </Link>
  )
}

/** Finance: this month's balance, income vs spending and a 6-month trend. */
async function FinanceWidget() {
  const month = thisMonth()
  const [t, data, overview] = await Promise.all([
    getTranslations('dashboard'),
    serverApi(`/api/finance/months/${month}`, MonthDto),
    serverApi(`/api/finance/overview?from=${addMonths(month, -5)}&to=${month}`, FinanceOverviewDto),
  ])
  const { summary } = data
  const alerts = data.budgets.filter((b) => b.status !== 'ok').length
  const balances = overview.months.map((m) => Number(BigInt(m.balanceMinor)))
  const peak = Math.max(1, ...balances.map(Math.abs))
  return (
    <Link href="/money" className="block active:opacity-90">
      <Hero tone="ink" decor={false}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm opacity-90">{t('balanceThisMonth')}</p>
            <p className="my-1 truncate font-display text-[32px] leading-none font-bold tabular-nums">
              {fmtServer(summary.balanceMinor)}
            </p>
          </div>
          <div aria-hidden className="flex h-12 shrink-0 items-end gap-1">
            {balances.map((v, i) => (
              <span
                key={i}
                className={cn(
                  'w-2.5 rounded-sm',
                  v < 0
                    ? 'bg-[#f06a61]'
                    : i === balances.length - 1
                      ? 'bg-[#22c46a]'
                      : 'bg-white/35',
                )}
                style={{ height: `${Math.max(8, (Math.abs(v) / peak) * 100)}%` }}
              />
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <p className="rounded-xl bg-white/10 px-3 py-2">
            <span className="block text-xs opacity-80">{t('income')}</span>
            <span className="num">{fmtServer(summary.totalIncomeMinor)}</span>
          </p>
          <p className="rounded-xl bg-white/10 px-3 py-2">
            <span className="block text-xs opacity-80">{t('spending')}</span>
            <span className="num">{fmtServer(summary.totalExpensesMinor)}</span>
          </p>
        </div>
        {alerts > 0 && (
          <p className="mt-2 rounded-xl bg-[#f0a04b]/25 px-3 py-1.5 text-xs font-medium">
            {t('budgetAlerts', { count: alerts })}
          </p>
        )}
      </Hero>
    </Link>
  )
}

/** Shared money: what others owe me (or I owe) across all ledgers. */
async function SharedWidget() {
  const [t, ledgers] = await Promise.all([
    getTranslations('dashboard'),
    serverApi('/api/ledgers', z.array(LedgerDto)),
  ])
  if (ledgers.length === 0) {
    return (
      <Link
        href="/shared"
        className="flex min-h-[88px] items-center gap-3 rounded-2xl border border-dashed bg-card px-4 active:bg-muted"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-[#996cac] text-white">
          <Plus aria-hidden className="size-6" />
        </span>
        <span>
          <span className="block font-semibold">{t('startShared')}</span>
          <span className="block text-sm text-muted-foreground">{t('startSharedHint')}</span>
        </span>
      </Link>
    )
  }
  // Each currency is summed on its own; different currencies are never added together.
  const byCurrency = new Map<string, bigint>()
  for (const l of ledgers) {
    byCurrency.set(l.currency, (byCurrency.get(l.currency) ?? 0n) + BigInt(l.myBalanceMinor))
  }
  const open = [...byCurrency].filter(([, net]) => net !== 0n)
  const owedToMe = open.every(([, net]) => net > 0n)
  const iOwe = open.every(([, net]) => net < 0n)
  const label =
    open.length === 0
      ? t('sharedSettled')
      : owedToMe
        ? t('sharedOwedToYou')
        : iOwe
          ? t('sharedYouOwe')
          : t('sharedBalances')
  /** With mixed directions each line carries its own sign. */
  const signed = (net: bigint, currency: string) =>
    `${owedToMe || iOwe ? '' : net > 0n ? '+' : '−'}${fmtServer((net < 0n ? -net : net).toString(), currency)}`
  return (
    <Link href="/shared" className="block active:opacity-90">
      <Hero tone="purple">
        <p className="text-sm opacity-90">{label}</p>
        {open.length === 0 ? (
          <p className="my-1 font-display text-[32px] leading-none font-bold">✓</p>
        ) : (
          open.map(([currency, net]) => (
            <p
              key={currency}
              className="my-1 font-display text-[32px] leading-none font-bold tabular-nums"
            >
              {signed(net, currency)}
            </p>
          ))
        )}
        <ul className="mt-3 space-y-1 text-sm">
          {ledgers.slice(0, 3).map((l) => {
            const b = BigInt(l.myBalanceMinor)
            return (
              <li
                key={l.id}
                className="flex justify-between gap-3 rounded-xl bg-white/12 px-3 py-1.5"
              >
                <span className="truncate">{l.name}</span>
                <span className="num shrink-0">
                  {b === 0n
                    ? '✓'
                    : `${b > 0n ? '+' : '−'}${fmtServer((b < 0n ? -b : b).toString(), l.currency)}`}
                </span>
              </li>
            )
          })}
        </ul>
      </Hero>
    </Link>
  )
}

/** One widget per feature, shown on the dashboard in this order. */
export const DASHBOARD_WIDGETS: Record<FeatureKey, Widget> = {
  trips: TripsWidget,
  finance: FinanceWidget,
  shared: SharedWidget,
}
