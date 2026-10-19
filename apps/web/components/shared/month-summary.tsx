'use client'

import type { LedgerMonthDto, MonthStatus } from '@iplan/contracts'
import { money, parseMoney, toDecimalString } from '@iplan/core'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/expenses'

const STATUS_ON: Record<'unpaid' | 'partial' | 'paid', string> = {
  unpaid: 'bg-card text-warning shadow-sm',
  partial: 'bg-card text-la shadow-sm',
  paid: 'bg-card text-success shadow-sm',
}

const STATUS_TEXT: Record<MonthStatus, string> = {
  none: 'text-muted-foreground',
  unpaid: 'text-warning',
  partial: 'text-la',
  paid: 'text-success',
}

/**
 * One month of a shared wallet on a plain card: what it cost, my part, what is
 * still to transfer, and the month's status (not paid / partly / paid) that the
 * members set.
 */
export function MonthSummary({
  month,
  currency,
  nameOf,
  readOnly,
  busy,
  onStatus,
}: {
  month: LedgerMonthDto
  currency: string
  nameOf: (id: string) => string
  readOnly: boolean
  busy: boolean
  onStatus: (status: 'unpaid' | 'partial' | 'paid', amount?: string) => void
}) {
  const t = useTranslations('shared')
  const [partial, setPartial] = useState(false)
  const [amount, setAmount] = useState('')
  const need = BigInt(month.needMinor)
  const paid = BigInt(month.paidMinor)
  /** Partial payments need exactly one person owing one other for the month. */
  const owedOnly = month.owed.length === 1 ? month.owed[0] : undefined
  const settles = need > 0n || paid > 0n

  return (
    <section className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{t('spentTogether')}</p>
      <p className="num mt-1 font-display text-[34px] leading-none font-bold">
        {fmt(month.totalMinor, currency)}
      </p>

      <dl className="mt-5 grid grid-cols-2 divide-x border-t pt-4">
        <div className="pr-4">
          <dt className="text-xs text-muted-foreground">{t('yourShare')}</dt>
          <dd className="num mt-0.5 text-lg font-semibold">{fmt(month.myShareMinor, currency)}</dd>
        </div>
        <div className="pl-4">
          <dt className="text-xs text-muted-foreground">{t('toSettle')}</dt>
          <dd className={cn('mt-0.5 text-lg font-semibold', STATUS_TEXT[month.status])}>
            {t(`status.${month.status}`)}
          </dd>
        </div>
      </dl>

      {month.status === 'unpaid' && month.transfers.length > 0 && (
        <ul className="mt-4 space-y-2 border-t pt-4">
          {month.transfers.map((tr) => (
            <li key={`${tr.from}-${tr.to}`} className="flex items-center gap-1.5 text-[15px]">
              <span className="truncate font-medium">{nameOf(tr.from)}</span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-faint" />
              <span className="truncate font-medium">{nameOf(tr.to)}</span>
              <span className="num ml-auto shrink-0 font-semibold">
                {fmt(tr.amountMinor, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {settles && (
        <div className="mt-4 border-t pt-4">
          {need > 0n && (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-[width]"
                  style={{ width: `${Math.min(100, Number((paid * 100n) / need))}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
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
                  className={cn('mt-2 text-sm font-medium', over ? 'text-la' : 'text-warning')}
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

      {settles && !readOnly && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">{t('statusLabel')}</p>
          <div
            role="radiogroup"
            aria-label={t('statusLabel')}
            className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1"
          >
            {(['unpaid', 'partial', 'paid'] as const).map((s) => {
              const on = partial ? s === 'partial' : month.status === s
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
          className="mt-3 space-y-2"
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
                  if (left > 0n) {
                    return t('stillOwes', {
                      from: nameOf(owedOnly.from),
                      to: nameOf(owedOnly.to),
                      amount: fmt(left, currency),
                    })
                  }
                  if (left === 0n) return t('exactlyPaid')
                  return t('overpaid', {
                    over: fmt(-left, currency),
                    from: nameOf(owedOnly.to),
                    to: nameOf(owedOnly.from),
                  })
                } catch {
                  return null
                }
              })()}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
