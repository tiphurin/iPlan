'use client'

import type { LedgerMonthDto } from '@iplan/contracts'
import { formatMonth } from '@iplan/i18n'
import { useTranslations } from 'next-intl'
import { Donut } from '@/components/charts/donut'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/expenses'
import { LEDGER_CATEGORY_COLORS } from '@/lib/ledgers'
import { useFormat } from '@/lib/use-format'

/** Last six months as bars (together vs my part) and the chosen month by category. */
export function WalletCharts({
  months,
  currency,
  selected,
  onSelect,
}: {
  months: LedgerMonthDto[]
  currency: string
  selected: string | null
  onSelect: (month: string) => void
}) {
  const t = useTranslations('shared')
  const f = useFormat()
  const recent = months.slice(0, 6).reverse()
  const peak = Math.max(1, ...recent.map((m) => Number(m.totalMinor)))
  const current = months.find((m) => m.month === selected) ?? months[0]
  if (!current) return null
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      <div>
        <div>
          <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-l5" />
              {t('chartTogether')}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-foreground" />
              {t('chartMine')}
            </span>
          </div>
          <div className="flex h-32 items-end gap-2">
            {recent.map((m) => {
              const on = m.month === current.month
              return (
                <button
                  key={m.month}
                  type="button"
                  onClick={() => onSelect(m.month)}
                  aria-pressed={on}
                  aria-label={formatMonth(m.month, { locale: f.locale })}
                  className={cn(
                    'flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-lg p-1',
                    on && 'bg-muted',
                  )}
                >
                  <span className="flex w-full flex-1 items-end justify-center gap-0.5">
                    <span
                      className="w-1/3 max-w-4 rounded-t bg-l5"
                      style={{ height: `${(Number(m.totalMinor) / peak) * 100}%` }}
                    />
                    <span
                      className="w-1/3 max-w-4 rounded-t bg-foreground"
                      style={{ height: `${(Number(m.myShareMinor) / peak) * 100}%` }}
                    />
                  </span>
                  <span className={cn('text-[11px]', on ? 'font-bold' : 'text-faint')}>
                    {formatMonth(m.month, { locale: f.locale }).split(' ')[0]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="border-t pt-4">
        <p className="mb-2 text-sm font-semibold">
          {formatMonth(current.month, { locale: f.locale })} · {fmt(current.totalMinor, currency)}
        </p>
        <Donut
          center={t('byCategory')}
          slices={current.byCategory.map((c) => ({
            key: c.category,
            label: `${t(`categories.${c.category}`)} · ${fmt(c.totalMinor, currency)}`,
            value: Number(c.totalMinor),
            color: LEDGER_CATEGORY_COLORS[c.category] ?? '#9aa3ae',
          }))}
        />
      </div>
    </div>
  )
}
