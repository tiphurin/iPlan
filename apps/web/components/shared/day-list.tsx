'use client'

import type { LedgerEntryDto } from '@iplan/contracts'
import type { Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/expenses'
import { LEDGER_CATEGORY_COLORS, groupByDay } from '@/lib/ledgers'
import { useFormat } from '@/lib/use-format'

/** True when someone besides the payer has a share to pay back. */
function someoneOwes(entry: LedgerEntryDto): boolean {
  return entry.shares.some((s) => s.userId !== entry.paidBy && BigInt(s.amountMinor) > 0n)
}

/**
 * A month's entries, newest day first. Each expense someone owes on has its own
 * "paid / not paid" dropdown; pay-backs show as "A paid B" in green.
 */
export function DayList({
  ledgerId,
  entries,
  currency,
  nameOf,
  readOnly,
  busy,
  paidByMonth,
  onEntryPaid,
}: {
  ledgerId: string
  entries: LedgerEntryDto[]
  currency: string
  nameOf: (id: string) => string
  readOnly: boolean
  busy: boolean
  /** The whole month was paid in one go, so every expense in it counts as paid. */
  paidByMonth: boolean
  onEntryPaid: (entry: LedgerEntryDto, paidBack: boolean) => void
}) {
  const t = useTranslations('shared')
  const f = useFormat()
  const days = groupByDay(entries)

  return (
    <div className="space-y-5">
      {days.map((day) => {
        const spent = day.entries
          .filter((e) => e.kind === 'expense')
          .reduce((sum, e) => sum + BigInt(e.amountMinor), 0n)
        return (
          <section key={day.date} aria-label={f.day(day.date)}>
            <h3 className="flex items-baseline justify-between gap-3 px-1 pb-2 text-sm font-semibold text-muted-foreground">
              <span>{f.day(day.date)}</span>
              {spent > 0n && <span className="num font-medium">{fmt(spent, currency)}</span>}
            </h3>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {day.entries.map((e) => {
                const settlement = e.kind === 'settlement'
                const owes = !settlement && someoneOwes(e)
                return (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: settlement
                          ? 'var(--success)'
                          : (LEDGER_CATEGORY_COLORS[e.category] ?? '#9aa3ae'),
                      }}
                    />
                    <Link
                      href={`/shared/${ledgerId}/entries/${e.id}` as Route}
                      className="flex min-h-11 min-w-0 flex-1 flex-col justify-center active:opacity-70"
                    >
                      <span
                        className={cn('block truncate font-medium', settlement && 'text-success')}
                      >
                        {settlement
                          ? t('settlementTitle', {
                              from: nameOf(e.paidBy),
                              to: nameOf(e.shares[0]?.userId ?? ''),
                            })
                          : e.title}
                      </span>
                      {!settlement && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {t('paidBy', { name: nameOf(e.paidBy) })}
                        </span>
                      )}
                    </Link>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={cn('num font-semibold', settlement && 'text-success')}>
                        {fmt(e.amountMinor, currency)}
                      </span>
                      {owes && paidByMonth && !e.paidBack && (
                        <span className="inline-flex min-h-8 items-center rounded-full bg-success/12 px-3 text-[13px] font-semibold text-success">
                          {t('entryPaid')}
                        </span>
                      )}
                      {owes && (e.paidBack || !paidByMonth) && (
                        <Select
                          aria-label={`${t('entryStatus')} · ${e.title}`}
                          value={e.paidBack ? 'paid' : 'unpaid'}
                          disabled={readOnly || busy}
                          onChange={(ev) => onEntryPaid(e, ev.target.value === 'paid')}
                          className={cn(
                            'min-h-11 w-auto gap-1 rounded-full border-transparent px-3 text-[13px] font-semibold',
                            e.paidBack
                              ? 'bg-success/12 text-success'
                              : 'bg-warning/12 text-warning',
                          )}
                        >
                          <option value="unpaid">{t('entryUnpaid')}</option>
                          <option value="paid">{t('entryPaid')}</option>
                        </Select>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
