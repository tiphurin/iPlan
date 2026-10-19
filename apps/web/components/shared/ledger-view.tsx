'use client'

import type { LedgerDetailDto, LedgerEntryDto } from '@iplan/contracts'
import { money, toDecimalString } from '@iplan/core'
import { todayKey } from '@iplan/i18n'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Eye, Pencil, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Avatar } from '@/components/avatar'
import { BackLink } from '@/components/back-link'
import { Button } from '@/components/ui/button'
import { Card, Hero, ListGroup, SectionTitle } from '@/components/ui/card'
import { Fab } from '@/components/ui/fab'
import { PersonPicker } from '@/components/person-picker'
import { Input } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import { MonthCard } from './month-card'
import { WalletCharts } from './wallet-charts'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/expenses'
import { ledgerKeys, useLedger, useLedgerMutations } from '@/lib/ledgers'

export function LedgerView({ initial, meId }: { initial: LedgerDetailDto; meId: string }) {
  const t = useTranslations()
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
  const thisMonth = ledger.months.find((x) => x.month === todayKey('Asia/Bangkok').slice(0, 7))
  const [openMonth, setOpenMonth] = useState<string | null>(ledger.months[0]?.month ?? null)
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [name, setName] = useState(ledger.name)
  const byId = new Map(ledger.entries.map((e) => [e.id, e]))
  /** Expenses by their date; settlements by the month (or expense) they settle. */
  const entryMonth = (e: LedgerEntryDto): string =>
    e.settlesMonth ??
    (e.settlesEntryId ? byId.get(e.settlesEntryId)?.date.slice(0, 7) : undefined) ??
    e.date.slice(0, 7)

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
      <div className="space-y-5 px-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6 md:space-y-0">
        <div className="space-y-5 md:sticky md:top-4">
          {outsider ? (
            <Hero tone="ink">
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
          )}

          <section>
            <SectionTitle>{t('shared.whoOwes')}</SectionTitle>
            {ledger.transfers.length === 0 ? (
              <Card className="text-center font-medium text-success">✓ {t('shared.settled')}</Card>
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
                            date: todayKey('Asia/Bangkok'),
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
              selected={openMonth}
              onSelect={(m) => {
                setOpenMonth(m)
                document.getElementById(`month-${m}`)?.scrollIntoView({ block: 'start' })
              }}
            />
          )}
          <SectionTitle>{t('shared.byMonth')}</SectionTitle>
          {ledger.entries.length === 0 && (
            <Card className="py-8 text-center text-muted-foreground">{t('shared.noEntries')}</Card>
          )}
          {ledger.months.map((month) => (
            <div key={month.month} id={`month-${month.month}`} className="scroll-mt-4">
              <MonthCard
                ledgerId={ledger.id}
                month={month}
                entries={ledger.entries.filter((e) => entryMonth(e) === month.month)}
                currency={cur}
                nameOf={nameOf}
                readOnly={ledger.readOnly}
                busy={m.monthStatus.isPending || m.entryPaid.isPending}
                open={openMonth === month.month}
                onToggle={() => setOpenMonth((cur) => (cur === month.month ? null : month.month))}
                onStatus={(status, amount) =>
                  m.monthStatus
                    .mutateAsync({ month: month.month, status, ...(amount && { amount }) })
                    .catch(fail)
                }
                onEntryPaid={(id, paidBack) =>
                  m.entryPaid.mutateAsync({ id, paidBack }).catch(fail)
                }
              />
            </div>
          ))}
        </div>
      </div>

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

      {!ledger.readOnly && <Fab href={`/shared/${ledger.id}/new`} label={t('shared.addCost')} />}
    </>
  )
}
