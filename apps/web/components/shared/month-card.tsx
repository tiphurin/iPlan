'use client'

import type { LedgerEntryDto, LedgerMonthDto, MonthStatus } from '@iplan/contracts'
import { money, parseMoney, toDecimalString } from '@iplan/core'
import { formatMonth } from '@iplan/i18n'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/expenses'
import { LEDGER_CATEGORY_COLORS } from '@/lib/ledgers'
import { useFormat } from '@/lib/use-format'

const STATUS_ON: Record<'unpaid' | 'partial' | 'paid', string> = {
  unpaid: 'bg-card text-warning shadow-sm',
  partial: 'bg-card text-la shadow-sm',
  paid: 'bg-success text-white shadow-sm',
}

const STATUS_STYLE: Record<MonthStatus, string> = {
  none: 'bg-muted text-muted-foreground',
  unpaid: 'bg-warning/15 text-warning',
  partial: 'bg-la/15 text-la',
  paid: 'bg-success/15 text-success',
}

/**
 * One month of a shared wallet: what it cost, who owes whom for that month, a
 * status the members set (not paid / partly / paid) and each expense's own
 * "paid back" switch.
 */
export function MonthCard({
  ledgerId,
  month,
  entries,
  currency,
  nameOf,
  readOnly,
  busy,
  open,
  onToggle,
  onStatus,
  onEntryPaid,
}: {
  ledgerId: string
  month: LedgerMonthDto
  entries: LedgerEntryDto[]
  currency: string
  nameOf: (id: string) => string
  readOnly: boolean
  busy: boolean
  open: boolean
  onToggle: () => void
  onStatus: (status: 'unpaid' | 'partial' | 'paid', amount?: string) => void
  onEntryPaid: (entryId: string, paidBack: boolean) => void
}) {
  const t = useTranslations('shared')
  const f = useFormat()
  const [partial, setPartial] = useState(false)
  const [amount, setAmount] = useState('')
  const need = BigInt(month.needMinor)
  const paid = BigInt(month.paidMinor)
  /** Partial payments need exactly one person owing one other for the month. */
  const owedOnly = month.owed.length === 1 ? month.owed[0] : undefined
  const expenses = entries.filter((e) => e.kind === 'expense')
  /** A month-level payment that marking one expense as paid back would replace. */
  const hasMonthPayment = entries.some((e) => e.settlesMonth === month.month)

  return (
    <article className="rounded-2xl border bg-card">
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{formatMonth(month.month, { locale: f.locale })}</h3>
            <p className="text-sm text-muted-foreground">
              {t('monthTotal', {
                total: fmt(month.totalMinor, currency),
                mine: fmt(month.myShareMinor, currency),
              })}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
              STATUS_STYLE[month.status],
            )}
          >
            {t(`status.${month.status}`)}
          </span>
        </div>

        {month.status === 'unpaid' &&
          month.transfers.map((tr) => (
            <p key={`${tr.from}-${tr.to}`} className="flex items-center gap-1.5 text-[15px]">
              <span className="font-medium">{nameOf(tr.from)}</span>
              <ArrowRight aria-hidden className="size-4 text-faint" />
              <span className="font-medium">{nameOf(tr.to)}</span>
              <span className="num ml-auto">{fmt(tr.amountMinor, currency)}</span>
            </p>
          ))}

        {(need > 0n || paid > 0n) && (
          <div>
            {need > 0n && (
              <>
                <div className="h-[9px] overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-success transition-[width]"
                    style={{ width: `${Math.min(100, Number((paid * 100n) / need))}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-faint">
                  {t('paidOf', { paid: fmt(paid, currency), need: fmt(need, currency) })}
                </p>
              </>
            )}
            {/* Partly paid or paid too much: say plainly who owes whom now. */}
            {month.status === 'partial' &&
              month.transfers.map((tr) => {
                // The other way round from what was owed: someone paid too much.
                const over = month.owed.some((o) => o.from === tr.to && o.to === tr.from)
                return (
                  <p
                    key={`${tr.from}-${tr.to}`}
                    className={cn(
                      'mt-2 rounded-xl px-3 py-2 text-sm font-medium',
                      over ? 'bg-la/12 text-la' : 'bg-warning/12 text-warning',
                    )}
                  >
                    {over
                      ? t('overpaid', {
                          over: fmt(tr.amountMinor, currency),
                          from: nameOf(tr.from),
                          to: nameOf(tr.to),
                        })
                      : t('stillOwes', {
                          from: nameOf(tr.from),
                          to: nameOf(tr.to),
                          amount: fmt(tr.amountMinor, currency),
                        })}
                  </p>
                )
              })}
          </div>
        )}

        {(need > 0n || paid > 0n) && !readOnly && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('statusLabel')}</p>
            <div
              role="radiogroup"
              aria-label={t('statusLabel')}
              className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1"
            >
              {(['unpaid', 'partial', 'paid'] as const).map((s) => {
                const on = partial
                  ? s === 'partial'
                  : month.status === s || (s === 'paid' && month.status === 'paid')
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={busy || (s === 'partial' && !owedOnly)}
                    onClick={() => {
                      if (s === 'partial') {
                        setPartial(true)
                        setAmount(paid > 0n ? toDecimalString(money(paid, currency)) : '')
                        return
                      }
                      setPartial(false)
                      if (month.status !== s) onStatus(s)
                    }}
                    className={cn(
                      'min-h-11 rounded-xl px-1 text-sm font-semibold disabled:opacity-40',
                      on ? STATUS_ON[s] : 'text-muted-foreground',
                    )}
                  >
                    {t(s === 'partial' ? 'status.partialShort' : `status.${s}`)}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {partial && (
          <form
            className="space-y-2 rounded-2xl border p-3"
            onSubmit={(e) => {
              e.preventDefault()
              onStatus('partial', amount)
              setPartial(false)
            }}
          >
            <label className="block text-sm text-muted-foreground" htmlFor={`paid-${month.month}`}>
              {t('paidAmount')}
            </label>
            <div className="flex gap-2">
              <Input
                id={`paid-${month.month}`}
                inputMode="decimal"
                autoFocus
                placeholder="0.00"
                className="num"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              />
              <Button type="submit" variant="solid" disabled={!amount || busy}>
                {t('save')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPartial(false)}>
                {t('cancel')}
              </Button>
            </div>
            {owedOnly && amount && (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  // Live preview of the balance after this payment (more than owed is fine).
                  try {
                    const left = need - parseMoney(amount, currency).amount
                    const first = owedOnly
                    if (left > 0n) {
                      return t('stillOwes', {
                        from: nameOf(first.from),
                        to: nameOf(first.to),
                        amount: fmt(left, currency),
                      })
                    }
                    if (left === 0n) return t('exactlyPaid')
                    return t('overpaid', {
                      over: fmt(-left, currency),
                      from: nameOf(first.to),
                      to: nameOf(first.from),
                    })
                  } catch {
                    return null
                  }
                })()}
              </p>
            )}
          </form>
        )}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between border-t px-4 text-sm font-medium text-muted-foreground"
      >
        {t('entriesCount', { count: expenses.length })}
        <ChevronDown
          aria-hidden
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <ul className="divide-y border-t">
          {entries.map((e) => {
            const owes = e.shares.some((s) => s.userId !== e.paidBy && BigInt(s.amountMinor) > 0n)
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      e.kind === 'settlement'
                        ? 'var(--l2)'
                        : (LEDGER_CATEGORY_COLORS[e.category] ?? '#9aa3ae'),
                  }}
                />
                <Link
                  href={`/shared/${ledgerId}/entries/${e.id}` as Route}
                  className="min-w-0 flex-1 active:opacity-70"
                >
                  <span className="block truncate font-medium">
                    {e.kind === 'settlement'
                      ? t('settlementTitle', {
                          from: nameOf(e.paidBy),
                          to: nameOf(e.shares[0]?.userId ?? ''),
                        })
                      : e.title}
                  </span>
                  <span className="block truncate text-xs text-faint">
                    {f.day(e.date)}
                    {e.kind === 'expense' && ` · ${t('paidBy', { name: nameOf(e.paidBy) })}`}
                  </span>
                </Link>
                <span className={cn('num shrink-0', e.kind === 'settlement' && 'text-success')}>
                  {fmt(e.amountMinor, currency)}
                </span>
                {e.kind === 'expense' && owes && (
                  <button
                    type="button"
                    disabled={readOnly || busy}
                    onClick={() => {
                      // Marking one expense replaces the month's own payment; say so first.
                      if (
                        !e.paidBack &&
                        hasMonthPayment &&
                        !window.confirm(t('confirmReplaceMonthPaid'))
                      )
                        return
                      onEntryPaid(e.id, !e.paidBack)
                    }}
                    aria-pressed={e.paidBack}
                    className={cn(
                      'inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold',
                      e.paidBack
                        ? 'border-success bg-success/12 text-success'
                        : 'text-muted-foreground',
                    )}
                  >
                    {e.paidBack && <Check aria-hidden className="size-3.5" />}
                    {e.paidBack ? t('entryPaid') : t('entryUnpaid')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
