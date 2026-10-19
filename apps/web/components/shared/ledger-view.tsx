'use client'

import type { LedgerDetailDto, LedgerEntryDto } from '@iplan/contracts'
import { money, toDecimalString } from '@iplan/core'
import { formatMonth, todayKey } from '@iplan/i18n'
import { ArrowRight, Check, Trash2, UserPlus } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Avatar } from '@/components/avatar'
import { BackLink } from '@/components/back-link'
import { Button } from '@/components/ui/button'
import { Card, Hero, ListGroup, SectionTitle } from '@/components/ui/card'
import { Fab } from '@/components/ui/fab'
import { Input } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/expenses'
import { LEDGER_CATEGORY_COLORS, useLedger, useLedgerMutations } from '@/lib/ledgers'
import { useFormat } from '@/lib/use-format'

export function LedgerView({ initial, meId }: { initial: LedgerDetailDto; meId: string }) {
  const t = useTranslations()
  const f = useFormat()
  const router = useRouter()
  const { data: ledger } = useLedger(initial.id, initial)
  const m = useLedgerMutations(ledger.id)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const cur = ledger.currency
  const mine = BigInt(ledger.myBalanceMinor)
  const nameOf = (id: string) =>
    id === meId ? t('shared.you') : (ledger.members.find((x) => x.userId === id)?.name ?? '—')
  const fail = (e: unknown) => setError(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`))
  const thisMonth = ledger.months.find((x) => x.month === todayKey('Asia/Bangkok').slice(0, 7))

  // Entries grouped by day, newest first (the API already sorts them).
  const days = new Map<string, LedgerEntryDto[]>()
  for (const e of ledger.entries) days.set(e.date, [...(days.get(e.date) ?? []), e])

  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-6">
        <BackLink href="/shared" label={t('features.shared')} />
      </div>
      <header className="flex items-end justify-between gap-3 px-4 pb-4">
        <h1 className="truncate text-[28px] leading-tight font-bold md:text-4xl">{ledger.name}</h1>
        <span className="flex shrink-0 -space-x-2">
          {ledger.members.map((x) => (
            <Avatar key={x.userId} name={x.name} image={x.image} size={34} />
          ))}
        </span>
      </header>

      <div className="space-y-5 px-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6 md:space-y-0">
        <div className="space-y-5 md:sticky md:top-4">
          <Hero tone={mine > 0n ? 'green' : mine < 0n ? 'orange' : 'ink'}>
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

          {ledger.transfers.length > 0 && (
            <section>
              <SectionTitle>{t('shared.toSettle')}</SectionTitle>
              <ListGroup>
                {ledger.transfers.map((tr) => (
                  <li key={`${tr.from}-${tr.to}`} className="flex items-center gap-3 px-3.5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        {nameOf(tr.from)}
                        <ArrowRight aria-hidden className="size-4 text-faint" />
                        {nameOf(tr.to)}
                      </span>
                      <span className="num text-lg">{fmt(tr.amountMinor, cur)}</span>
                    </span>
                    <Button
                      variant="secondary"
                      disabled={m.settle.isPending}
                      onClick={() => {
                        if (!window.confirm(t('shared.confirmSettle'))) return
                        m.settle
                          .mutateAsync({
                            from: tr.from,
                            to: tr.to,
                            amount: toDecimalString(money(BigInt(tr.amountMinor), cur)),
                            date: todayKey('Asia/Bangkok'),
                          })
                          .catch(fail)
                      }}
                    >
                      <Check aria-hidden className="size-4" />
                      {t('shared.markPaid')}
                    </Button>
                  </li>
                ))}
              </ListGroup>
            </section>
          )}

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
                    {ledger.role === 'owner' && x.role !== 'owner' && (
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
            {ledger.role === 'owner' && (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!email.trim()) return
                  m.addMember
                    .mutateAsync(email.trim())
                    .then(() => {
                      setEmail('')
                      setError(null)
                    })
                    .catch(fail)
                }}
              >
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder={t('shared.addByEmail')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="solid"
                  className="shrink-0"
                  disabled={m.addMember.isPending}
                >
                  <UserPlus aria-hidden className="size-4" />
                  {t('common.add')}
                </Button>
              </form>
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

          {ledger.role === 'owner' && (
            <Button
              variant="ghost"
              className="w-full text-danger"
              onClick={async () => {
                if (!window.confirm(t('shared.confirmDelete', { name: ledger.name }))) return
                await m.remove.mutateAsync().catch(fail)
                router.replace('/shared')
                router.refresh()
              }}
            >
              <Trash2 aria-hidden className="size-4" />
              {t('shared.delete')}
            </Button>
          )}
        </div>

        <section>
          <SectionTitle>{t('shared.history')}</SectionTitle>
          {ledger.months.length > 1 && (
            <div className="scrollbar-none -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
              {ledger.months.slice(0, 6).map((x) => (
                <span
                  key={x.month}
                  className="shrink-0 rounded-2xl border bg-card px-3 py-2 text-sm"
                >
                  <span className="block text-xs text-faint">
                    {formatMonth(x.month, { locale: f.locale })}
                  </span>
                  <span className="num">{fmt(x.totalMinor, cur)}</span>
                </span>
              ))}
            </div>
          )}
          {ledger.entries.length === 0 && (
            <Card className="py-8 text-center text-muted-foreground">{t('shared.noEntries')}</Card>
          )}
          <div className="space-y-4">
            {[...days.entries()].map(([day, entries]) => (
              <div key={day}>
                <p className="mb-1.5 px-1 text-sm text-muted-foreground">{f.day(day)}</p>
                <ListGroup>
                  {entries.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/shared/${ledger.id}/entries/${e.id}` as Route}
                        className="flex min-h-[56px] items-center gap-3 px-3.5 py-2.5 active:bg-muted"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              e.kind === 'settlement'
                                ? 'var(--l2)'
                                : (LEDGER_CATEGORY_COLORS[e.category] ?? '#9aa3ae'),
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {e.kind === 'settlement'
                              ? t('shared.settlementTitle', {
                                  from: nameOf(e.paidBy),
                                  to: nameOf(e.shares[0]?.userId ?? ''),
                                })
                              : e.title}
                          </span>
                          {e.kind === 'expense' && (
                            <span className="block truncate text-xs text-faint">
                              {t('shared.paidBy', { name: nameOf(e.paidBy) })} ·{' '}
                              {e.shares
                                .map((s) => `${nameOf(s.userId)} ${fmt(s.amountMinor, cur)}`)
                                .join(' · ')}
                            </span>
                          )}
                        </span>
                        <span
                          className={cn('num shrink-0', e.kind === 'settlement' && 'text-success')}
                        >
                          {fmt(e.amountMinor, cur)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ListGroup>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Fab href={`/shared/${ledger.id}/new`} label={t('shared.addCost')} />
    </>
  )
}
