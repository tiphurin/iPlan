import { MonthDto, TripDto } from '@iplan/contracts'
import { type Locale, formatDateRange, todayKey } from '@iplan/i18n'
import { ChevronRight, Clock, Plus, Users, Wallet } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { fmtServer } from '@/lib/money-format'
import { getMe, serverApi } from '@/lib/server-api'
import { thisMonth } from '@/lib/this-month'
import { type TripPhase, tripPhase } from '@/lib/trip-dates'

const ORDER: TripPhase[] = ['ongoing', 'upcoming', 'past']

export default async function TripsPage() {
  const [t, me, locale, trips, money] = await Promise.all([
    getTranslations(),
    getMe(),
    getLocale(),
    serverApi('/api/trips', z.array(TripDto)),
    serverApi(`/api/finance/months/${thisMonth()}`, MonthDto),
  ])
  const grouped = new Map<TripPhase, TripDto[]>()
  for (const trip of trips) {
    const phase = tripPhase(trip, todayKey(trip.homeTimeZone))
    grouped.set(phase, [...(grouped.get(phase) ?? []), trip])
  }

  return (
    <>
      <PageHeader
        title={t('nav.trips')}
        subtitle={t('home.greeting', { name: me?.name ?? '' })}
        action={
          <Link
            href="/trips/new"
            aria-label={t('trips.new')}
            className={buttonVariants({ size: 'icon', className: 'rounded-full' })}
          >
            <Plus aria-hidden className="size-6" />
          </Link>
        }
      />
      <div className="space-y-6 px-4">
        <Dashboard trips={grouped} money={money} />
        {trips.length === 0 && (
          <Card className="py-10 text-center">
            <p className="text-lg font-semibold">{t('trips.empty')}</p>
            <p className="mt-1 text-muted-foreground">{t('trips.emptyHint')}</p>
            <Link href="/trips/new" className={cn(buttonVariants(), 'mt-5')}>
              {t('trips.new')}
            </Link>
          </Card>
        )}
        {ORDER.map((phase) => {
          const list = grouped.get(phase)
          if (!list?.length) return null
          return (
            <section key={phase}>
              <SectionTitle>{t(`trips.${phase}`)}</SectionTitle>
              <ul className="space-y-3">
                {(phase === 'past' ? [...list].reverse() : list).map((trip) => (
                  <li key={trip.id}>
                    <Link href={`/trips/${trip.id}` as Route} className="block active:opacity-80">
                      <Card
                        className={cn(
                          'flex items-center gap-3',
                          phase === 'ongoing' && 'border-primary/40 bg-primary/5',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-semibold">{trip.name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {formatDateRange(trip.startDate, trip.endDate, {
                              locale: locale as Locale,
                            })}
                            {trip.destination && ` · ${trip.destination}`}
                          </p>
                          <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <Users aria-hidden className="size-3.5" />
                            {t('trips.members', { count: trip.memberCount })}
                            <span className="rounded-full bg-muted px-2 py-0.5">
                              {t(`trips.role.${trip.role}`)}
                            </span>
                          </p>
                        </div>
                        <ChevronRight
                          aria-hidden
                          className="size-5 shrink-0 text-muted-foreground"
                        />
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}

async function Dashboard({ trips, money }: { trips: Map<TripPhase, TripDto[]>; money: MonthDto }) {
  const t = await getTranslations('home')
  const tf = await getTranslations('finance')
  const ongoing = trips.get('ongoing')?.[0]
  const next = trips.get('upcoming')?.[0]
  const alerts = money.budgets.filter((b) => b.status !== 'ok').length
  const balance = BigInt(money.summary.balanceMinor)
  const daysUntil = next
    ? Math.round(
        (Date.parse(next.startDate) - Date.parse(todayKey(next.homeTimeZone))) / 86_400_000,
      )
    : 0
  return (
    <div className="grid grid-cols-2 gap-3">
      {ongoing ? (
        <Link
          href={`/trips/${ongoing.id}/today` as Route}
          className="col-span-2 block active:opacity-80"
        >
          <Card className="flex items-center gap-3 border-primary/40 bg-primary text-primary-foreground">
            <Clock aria-hidden className="size-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm opacity-90">{t('onTrip')}</p>
              <p className="truncate text-lg font-semibold">{ongoing.name}</p>
            </div>
            <span className="text-sm font-medium">{t('openToday')} →</span>
          </Card>
        </Link>
      ) : next ? (
        <Link href={`/trips/${next.id}` as Route} className="col-span-2 block active:opacity-80">
          <Card className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">{t('nextTrip')}</p>
              <p className="truncate text-lg font-semibold">{next.name}</p>
            </div>
            <span className="text-2xl font-bold text-primary">
              {t('inDays', { count: daysUntil })}
            </span>
          </Card>
        </Link>
      ) : null}
      <Link href="/money" className="col-span-2 block active:opacity-80">
        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet aria-hidden className="size-4" />
            {t('thisMonth')}
          </div>
          <p className={cn('text-3xl font-bold tabular-nums', balance < 0n && 'text-danger')}>
            {fmtServer(money.summary.balanceMinor)}
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-success">↑ {fmtServer(money.summary.totalIncomeMinor)}</span>
            <span className="text-danger">↓ {fmtServer(money.summary.totalExpensesMinor)}</span>
          </div>
          {alerts > 0 && (
            <p className="rounded-lg bg-warning/15 px-2.5 py-1.5 text-xs font-medium text-warning">
              {t('budgetAlerts', { count: alerts })}
            </p>
          )}
          <span className="sr-only">{tf('title')}</span>
        </Card>
      </Link>
    </div>
  )
}
