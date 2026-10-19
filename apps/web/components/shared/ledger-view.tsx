'use client'

import type { LedgerDetailDto, LedgerEntryDto } from '@iplan/contracts'
import { money, toDecimalString } from '@iplan/core'
import { formatMonthLong, todayKey } from '@iplan/i18n'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { BackLink } from '@/components/back-link'
import { PersonPicker } from '@/components/person-picker'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, Hero, ListGroup, SectionTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/chip'
import { Fab } from '@/components/ui/fab'
import { Input } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import { DayList } from './day-list'
import { MonthSummary } from './month-summary'
import { WalletCharts } from './wallet-charts'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/expenses'
import {
  type WalletTab,
  entryMonth,
  ledgerKeys,
  newEntryDate,
  parseWalletTab,
  pickWalletMonth,
  stepWalletMonth,
  useLedger,
  useLedgerMutations,
  walletMonths,
} from '@/lib/ledgers'
import { useFormat } from '@/lib/use-format'

/**
 * A shared wallet in two tabs: the overview (my balance, who owes whom, members,
 * charts) and the monthly summary (‹ month ›, the month's status, then its
 * entries day by day, each with its own paid / not paid choice). Tab and month
 * are kept in the URL.
 */
export function LedgerView({
  initial,
  meId,
  tab: initialTab,
  month: monthParam,
}: {
  initial: LedgerDetailDto
  meId: string
  /** Raw "?tab=" and "?month="; checked here. */
  tab: string | undefined
  month: string | undefined
}) {
  const t = useTranslations()
  const f = useFormat()
  const router = useRouter()
  const { data: ledger } = useLedger(initial.id, initial)
  const m = useLedgerMutations(ledger.id)
  const client = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const cur = ledger.currency
  const mine = BigInt(ledger.myBalanceMinor)
  const outsider = !ledger.members.some((x) => x.userId === meId)
  const imageOf = (id: string) => ledger.members.find((x) => x.userId === id)?.image ?? null
  const nameOf = (id: string) =>
    id === meId ? t('shared.you') : (ledger.members.find((x) => x.userId === id)?.name ?? '—')
  const fail = (e: unknown) => setError(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`))
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [name, setName] = useState(ledger.name)

  const today = todayKey('Asia/Bangkok')
  const current = today.slice(0, 7)
  const byMonth = useMemo(() => {
    const byId = new Map(ledger.entries.map((e) => [e.id, e]))
    const groups = new Map<string, LedgerEntryDto[]>()
    for (const e of ledger.entries) {
      const key = entryMonth(e, byId)
      groups.set(key, [...(groups.get(key) ?? []), e])
    }
    return groups
  }, [ledger.entries])
  const withData = useMemo(
    () => [...new Set([...ledger.months.map((x) => x.month), ...byMonth.keys()])],
    [ledger.months, byMonth],
  )
  const months = walletMonths(withData, current)

  const [tab, setTab] = useState<WalletTab>(() => parseWalletTab(initialTab))
  const [month, setMonth] = useState(() => pickWalletMonth(monthParam, withData, current))
  // A month can disappear (its last entry deleted); fall back to the default one.
  const shown = months.includes(month) ? month : pickWalletMonth(undefined, withData, current)
  const monthData = ledger.months.find((x) => x.month === shown)
  const monthEntries = byMonth.get(shown) ?? []
  const thisMonth = ledger.months.find((x) => x.month === current)
  const [chartMonth, setChartMonth] = useState<string | null>(ledger.months[0]?.month ?? null)

  function sync(nextTab: WalletTab, nextMonth: string) {
    setTab(nextTab)
    setMonth(nextMonth)
    setError(null)
    const query = nextTab === 'months' ? `?tab=months&month=${nextMonth}` : ''
    router.replace(`/shared/${ledger.id}${query}` as Route, { scroll: false })
  }
  const prev = stepWalletMonth(months, shown, -1)
  const next = stepWalletMonth(months, shown, 1)
  const addHref = `/shared/${ledger.id}/new?date=${tab === 'months' ? newEntryDate(shown, today) : today}`
  const hasMonthPayment = monthEntries.some((e) => e.settlesMonth === shown)

  const errorBox = error && (
    <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  )

  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-6">
        <BackLink href="/shared" label={t('features.shared')} />
      </div>
      <header className="flex items-end justify-between gap-3 px-4 pb-4">
        <div className="flex min-w-0 items-center gap-1">
          <h1 className="truncate text-[28px] leading-tight font-bold md:text-4xl">
            {ledger.name}
          </h1>
          {ledger.role === 'owner' && !ledger.readOnly && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('shared.rename')}
              onClick={() => {
                setName(ledger.name)
                setRenameError(null)
                setRenaming(true)
              }}
            >
              <Pencil aria-hidden className="size-5" />
            </Button>
          )}
        </div>
        <span className="flex shrink-0 -space-x-2">
          {ledger.members.map((x) => (
            <Avatar key={x.userId} name={x.name} image={x.image} size={34} />
          ))}
        </span>
      </header>

      {ledger.readOnly && (
        <p className="mx-4 mb-4 flex items-center gap-2 rounded-2xl bg-l1/12 px-4 py-3 text-sm font-medium text-l1">
          <Eye aria-hidden className="size-4" />
          {t('shared.readOnly')}
        </p>
      )}

      <div className="px-4">
        <Segmented<WalletTab>
          label={t('shared.tabsLabel')}
          value={tab}
          onChange={(value) => sync(value, shown)}
          options={[
            { value: 'overview', label: t('shared.tabOverview') },
            { value: 'months', label: t('shared.byMonth') },
          ]}
          className="mb-5 md:max-w-sm"
        />
      </div>

      {tab === 'overview' ? (
        <div className="space-y-5 px-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6 md:space-y-0">
          <div className="space-y-5 md:sticky md:top-4">
            {outsider ? (
              <Hero variant="solid" tone="ink">
                <p className="text-sm opacity-90">{t('shared.overall')}</p>
                {ledger.transfers.length === 0 ? (
                  <p className="my-1 font-display text-[28px] font-bold">{t('shared.settled')}</p>
                ) : (
                  ledger.transfers.map((tr) => (
                    <p key={`${tr.from}-${tr.to}`} className="my-1 text-[17px]">
                      {t('shared.owesTo', {
                        from: nameOf(tr.from),
                        to: nameOf(tr.to),
                        amount: fmt(tr.amountMinor, cur),
                      })}
                    </p>
                  ))
                )}
              </Hero>
            ) : (
              <Hero variant="solid" tone={mine > 0n ? 'green' : mine < 0n ? 'orange' : 'ink'}>
                <p className="text-sm opacity-90">{t('shared.yourBalance')}</p>
                <p className="my-1 font-display text-[34px] leading-none font-bold tabular-nums">
                  {mine === 0n ? t('shared.settled') : fmt(mine < 0n ? -mine : mine, cur)}
                </p>
                <p className="text-[15px] opacity-95">
                  {mine > 0n ? t('shared.othersOweYou') : mine < 0n ? t('shared.youOweOthers') : ''}
                </p>
                {thisMonth && (
                  <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-sm">
                    {t('shared.thisMonth', {
                      total: fmt(thisMonth.totalMinor, cur),
                      mine: fmt(thisMonth.myShareMinor, cur),
                    })}
                  </p>
                )}
              </Hero>
            )}

            <section>
              <SectionTitle>{t('shared.whoOwes')}</SectionTitle>
              {ledger.transfers.length === 0 ? (
                <Card className="text-center font-medium text-success">
                  ✓ {t('shared.settled')}
                </Card>
              ) : (
                <ul className="space-y-2">
                  {ledger.transfers.map((tr) => (
                    <li
                      key={`${tr.from}-${tr.to}`}
                      className="space-y-3 rounded-2xl border bg-card p-4"
                    >
                      {/* Person who owes → person who gets paid, with the amount in the middle. */}
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                        <span className="flex flex-col items-center gap-1">
                          <Avatar name={nameOf(tr.from)} image={imageOf(tr.from)} size={44} />
                          <span className="max-w-full truncate text-sm font-medium">
                            {nameOf(tr.from)}
                          </span>
                          <span className="text-xs text-warning">{t('shared.pays')}</span>
                        </span>
                        <span className="flex flex-col items-center">
                          <span className="num text-xl">{fmt(tr.amountMinor, cur)}</span>
                          <ArrowRight aria-hidden className="size-6 text-faint" />
                        </span>
                        <span className="flex flex-col items-center gap-1">
                          <Avatar name={nameOf(tr.to)} image={imageOf(tr.to)} size={44} />
                          <span className="max-w-full truncate text-sm font-medium">
                            {nameOf(tr.to)}
                          </span>
                          <span className="text-xs text-success">{t('shared.receives')}</span>
                        </span>
                      </div>
                      <Button
                        variant="primary"
                        className={cn('w-full', ledger.readOnly && 'hidden')}
                        disabled={m.settle.isPending}
                        onClick={() => {
                          if (!window.confirm(t('shared.confirmSettle'))) return
                          m.settle
                            .mutateAsync({
                              from: tr.from,
                              to: tr.to,
                              amount: toDecimalString(money(BigInt(tr.amountMinor), cur)),
                              date: today,
                            })
                            .catch(fail)
                        }}
                      >
                        <Check aria-hidden className="size-4" />
                        {t('shared.markPaidAmount', { amount: fmt(tr.amountMinor, cur) })}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <SectionTitle>{t('shared.members')}</SectionTitle>
              <ListGroup>
                {ledger.members.map((x) => {
                  const bal = BigInt(x.balanceMinor)
                  return (
                    <li key={x.userId} className="flex items-center gap-3 px-3.5 py-2.5">
                      <Avatar name={x.name} image={x.image} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {x.name}
                          {x.userId === meId && ` (${t('shared.you')})`}
                        </span>
                        <span
                          className={cn(
                            'block text-xs',
                            bal > 0n ? 'text-success' : bal < 0n ? 'text-warning' : 'text-faint',
                          )}
                        >
                          {bal === 0n
                            ? t('shared.settled')
                            : bal > 0n
                              ? t('shared.gets', { amount: fmt(bal, cur) })
                              : t('shared.owes', { amount: fmt(-bal, cur) })}
                        </span>
                      </span>
                      {ledger.role === 'owner' && !ledger.readOnly && x.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('common.delete')}
                          onClick={() =>
                            window.confirm(t('shared.confirmRemove', { name: x.name })) &&
                            m.removeMember.mutateAsync(x.userId).catch(fail)
                          }
                        >
                          <Trash2 aria-hidden className="size-4 text-danger" />
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ListGroup>
              {ledger.pendingInvites.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {ledger.pendingInvites.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-2xl border border-dashed bg-card px-3.5 py-2"
                    >
                      <Avatar name={p.name} image={p.image} size={30} />
                      <span className="flex-1 truncate text-sm">{p.name}</span>
                      <span className="text-xs text-warning">{t('shared.awaiting')}</span>
                      {ledger.role === 'owner' && !ledger.readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('shared.cancelInvite')}
                          onClick={() =>
                            apiFetch(`/api/invitations/${p.id}`, { method: 'DELETE' })
                              .then(() => client.invalidateQueries({ queryKey: ledgerKeys.all }))
                              .catch(fail)
                          }
                        >
                          <X aria-hidden className="size-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {ledger.role === 'owner' && !ledger.readOnly && (
                <div className="mt-3">
                  <p className="mb-1.5 text-sm text-muted-foreground">{t('shared.invite')}</p>
                  <PersonPicker
                    exclude={[
                      ...ledger.members.map((x) => x.userId),
                      ...ledger.pendingInvites.map((p) => p.userId),
                    ]}
                    busy={m.invite.isPending}
                    onPick={(p) =>
                      m.invite
                        .mutateAsync(p.id)
                        .then(() => setError(null))
                        .catch(fail)
                    }
                  />
                </div>
              )}
              {error && (
                <p
                  role="alert"
                  className="mt-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger"
                >
                  {error}
                </p>
              )}
            </section>

            {ledger.role === 'owner' && !ledger.readOnly && (
              <Button
                variant="ghost"
                className="w-full text-danger"
                onClick={async () => {
                  if (!window.confirm(t('shared.confirmDelete', { name: ledger.name }))) return
                  try {
                    await m.remove.mutateAsync()
                  } catch (e) {
                    fail(e)
                    return
                  }
                  router.replace('/shared')
                  router.refresh()
                }}
              >
                <Trash2 aria-hidden className="size-4" />
                {t('shared.delete')}
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {ledger.months.length > 0 && (
              <WalletCharts
                months={ledger.months}
                currency={cur}
                selected={chartMonth}
                onSelect={setChartMonth}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="px-4">
          <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-start md:gap-6">
            <div className="space-y-4 md:sticky md:top-4">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('shared.prevMonth')}
                  disabled={!prev}
                  onClick={() => prev && sync('months', prev)}
                >
                  <ChevronLeft aria-hidden className="size-6" />
                </Button>
                <p aria-live="polite" className="font-display text-xl font-semibold">
                  {formatMonthLong(shown, { locale: f.locale })}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('shared.nextMonth')}
                  disabled={!next}
                  onClick={() => next && sync('months', next)}
                >
                  <ChevronRight aria-hidden className="size-6" />
                </Button>
              </div>
              {monthData && (
                <MonthSummary
                  key={shown}
                  month={monthData}
                  currency={cur}
                  nameOf={nameOf}
                  readOnly={ledger.readOnly}
                  busy={m.monthStatus.isPending || m.entryPaid.isPending}
                  onStatus={(status, amount) => {
                    setError(null)
                    m.monthStatus
                      .mutateAsync({ month: shown, status, ...(amount && { amount }) })
                      .catch(fail)
                  }}
                />
              )}
              {errorBox}
            </div>

            <div className="mt-6 md:mt-0">
              {monthEntries.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-10 text-center">
                  <p className="text-lg font-semibold">{t('shared.emptyMonth')}</p>
                  {!ledger.readOnly && (
                    <>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('shared.emptyMonthHint')}
                      </p>
                      <Link
                        href={addHref as Route}
                        className={cn(buttonVariants({ variant: 'secondary' }), 'mt-5')}
                      >
                        <Plus aria-hidden className="size-4" />
                        {t('shared.addCost')}
                      </Link>
                    </>
                  )}
                </div>
              ) : (
                <DayList
                  ledgerId={ledger.id}
                  entries={monthEntries}
                  currency={cur}
                  nameOf={nameOf}
                  readOnly={ledger.readOnly}
                  busy={m.monthStatus.isPending || m.entryPaid.isPending}
                  paidByMonth={monthData?.status === 'paid' && hasMonthPayment}
                  onEntryPaid={(entry, paidBack) => {
                    // Marking one expense replaces the month's own payment; say so first.
                    if (
                      paidBack &&
                      hasMonthPayment &&
                      !window.confirm(t('shared.confirmReplaceMonthPaid'))
                    )
                      return
                    setError(null)
                    m.entryPaid.mutateAsync({ id: entry.id, paidBack }).catch(fail)
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <Sheet open={renaming} onClose={() => setRenaming(false)} title={t('shared.rename')}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            m.rename
              .mutateAsync({ name: name.trim(), currency: cur })
              .then(() => setRenaming(false))
              .catch((e: unknown) =>
                setRenameError(
                  e instanceof ApiError
                    ? (e.fields.name ?? t(`errors.${e.code}`))
                    : t('errors.INTERNAL'),
                ),
              )
          }}
        >
          <Input
            autoFocus
            value={name}
            maxLength={80}
            aria-label={t('shared.newName')}
            onChange={(e) => setName(e.target.value)}
          />
          {renameError && (
            <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {renameError}
            </p>
          )}
          <Button type="submit" size="lg" disabled={!name.trim() || m.rename.isPending}>
            {t('shared.save')}
          </Button>
        </form>
      </Sheet>

      {!ledger.readOnly && <Fab href={addHref} label={t('shared.addCost')} />}
    </>
  )
}
