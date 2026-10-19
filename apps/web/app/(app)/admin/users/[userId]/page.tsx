import { AdminUserDataDto, MonthDto, isAdminRole } from '@iplan/contracts'
import { type Locale, formatDateRange, formatMonth } from '@iplan/i18n'
import { Eye, Map as MapIcon, Wallet } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { Avatar } from '@/components/avatar'
import { BackLink } from '@/components/back-link'
import { Card, Hero, ListGroup, SectionTitle } from '@/components/ui/card'
import { ListRow } from '@/components/ui/list-row'
import { fmtServer } from '@/lib/money-format'
import { orNotFound } from '@/lib/or-not-found'
import { getMe, serverApi } from '@/lib/server-api'
import { thisMonth, validMonth } from '@/lib/this-month'

export const metadata: Metadata = { title: 'User data' }

/** What one user has, for admins. Opening it is written to the audit log. */
export default async function AdminUserDataPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const me = await getMe()
  if (!me || !isAdminRole(me.role)) notFound()
  const { userId } = await params
  const month = validMonth((await searchParams).month) ?? thisMonth()
  const [t, locale, data, money] = await Promise.all([
    getTranslations(),
    getLocale(),
    orNotFound(serverApi(`/api/admin/users/${encodeURIComponent(userId)}/data`, AdminUserDataDto)),
    serverApi(
      `/api/admin/users/${encodeURIComponent(userId)}/finance/months/${month}`,
      MonthDto,
    ).catch(() => null),
  ])
  const { user } = data
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-6">
        <BackLink href="/admin" label={t('admin.title')} />
      </div>
      <header className="flex items-center gap-4 px-4 pb-4">
        <Avatar name={user.name} image={user.image} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">
            {user.name}
            {user.nickname && (
              <span className="ml-1.5 text-lg font-medium text-muted-foreground">
                ({user.nickname})
              </span>
            )}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </header>
      <div className="space-y-5 px-4">
        <p className="flex items-center gap-2 rounded-2xl bg-l1/12 px-4 py-3 text-sm font-medium text-l1">
          <Eye aria-hidden className="size-4 shrink-0" />
          {me.role === 'superadmin' ? t('admin.viewingSuper') : t('admin.viewingReadOnly')}
        </p>
        <div className="space-y-5 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
          <div className="space-y-5">
            <section>
              <SectionTitle>{t('features.trips')}</SectionTitle>
              {data.trips.length === 0 ? (
                <Card className="text-sm text-muted-foreground">{t('admin.nothing')}</Card>
              ) : (
                <ListGroup>
                  {data.trips.map((trip) => (
                    <ListRow
                      key={trip.id}
                      href={`/trips/${trip.id}`}
                      icon={<MapIcon aria-hidden className="size-5 text-l2" />}
                      title={trip.name}
                      meta={`${formatDateRange(trip.startDate, trip.endDate, {
                        locale: locale as Locale,
                      })} · ${t(`trips.role.${trip.role}`)}`}
                    />
                  ))}
                </ListGroup>
              )}
            </section>
            <section>
              <SectionTitle>{t('features.shared')}</SectionTitle>
              {data.ledgers.length === 0 ? (
                <Card className="text-sm text-muted-foreground">{t('admin.nothing')}</Card>
              ) : (
                <ListGroup>
                  {data.ledgers.map((ledger) => (
                    <ListRow
                      key={ledger.id}
                      href={`/shared/${ledger.id}`}
                      icon={<Wallet aria-hidden className="size-5 text-l5" />}
                      title={ledger.name}
                    />
                  ))}
                </ListGroup>
              )}
            </section>
          </div>
          {money && (
            <section>
              <SectionTitle>
                {t('features.finance')} · {formatMonth(month, { locale: locale as Locale })}
              </SectionTitle>
              <Hero tone="ink" decor={false}>
                <p className="text-sm opacity-90">{t('finance.balance')}</p>
                <p className="my-1 font-display text-[32px] leading-none font-bold">
                  {fmtServer(money.summary.balanceMinor)}
                </p>
                <p className="mt-2 flex justify-between text-sm">
                  <span>↑ {fmtServer(money.summary.totalIncomeMinor)}</span>
                  <span>↓ {fmtServer(money.summary.totalExpensesMinor)}</span>
                </p>
              </Hero>
              {money.lines.length + money.transactions.length > 0 && (
                <ListGroup className="mt-3">
                  {money.lines.map((line) => (
                    <ListRow
                      key={line.ruleId}
                      title={line.name}
                      meta={
                        line.kind === 'income'
                          ? t('finance.income')
                          : line.kind === 'deduction'
                            ? t('finance.deductions')
                            : t('finance.fixed')
                      }
                      trailing={<span className="num">{fmtServer(line.amountMinor)}</span>}
                    />
                  ))}
                  {money.transactions.map((tx) => (
                    <ListRow
                      key={tx.id}
                      title={tx.title}
                      meta={tx.date}
                      trailing={
                        <span className="num">
                          {tx.kind === 'income' ? '+' : '−'}
                          {fmtServer(tx.amountMinor)}
                        </span>
                      }
                    />
                  ))}
                </ListGroup>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
