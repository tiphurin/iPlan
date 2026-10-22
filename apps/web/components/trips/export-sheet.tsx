'use client'

import { ExpenseDto, ExpenseSummaryDto, PoolDto, type TripDetailDto } from '@iplan/contracts'
import { Download, Eye, FileSpreadsheet, FileText, Sheet as SheetIcon } from 'lucide-react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { createTranslator, useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { exportTripExcel } from '@/lib/excel'
import { usableRate } from '@/lib/money-convert'

type Format = 'pdf' | 'excel' | 'csv'
const FORMATS = [
  { key: 'pdf', icon: FileText },
  { key: 'excel', icon: FileSpreadsheet },
  { key: 'csv', icon: SheetIcon },
] as const

type Lang = 'th' | 'en'

/** The print page for the chosen PDF parts, language and currency, e.g. /print/trips/x?sections=plan,expenses&lang=th&currency=KRW. */
export function printHref(
  tripId: string,
  plan: boolean,
  expenses: boolean,
  lang: Lang,
  currency: string,
  print = false,
) {
  const sections = [plan && 'plan', expenses && 'expenses'].filter(Boolean).join(',')
  return `/print/trips/${tripId}?sections=${sections}&lang=${lang}&currency=${currency}${print ? '&print=1' : ''}`
}

/** File-name-safe trip name ("Seoul 2026"), same rule as the API's CSV name. */
export function safeFileName(name: string): string {
  const cleaned = [...name]
    .map((ch) => (ch < ' ' || '\\/:*?"<>|'.includes(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return cleaned || 'trip'
}

/** Messages for the export language, which may differ from the app's. */
async function translatorFor(lang: Lang) {
  const messages = (
    lang === 'th' ? await import('@/messages/th.json') : await import('@/messages/en.json')
  ).default
  return createTranslator({ locale: lang, messages }) as unknown as (
    key: string,
    values?: Record<string, string | number>,
  ) => string
}

/**
 * "Export": pick PDF, Excel or CSV; for a PDF pick the trip plan and/or the
 * costs (with all charts), look at a preview, then confirm or cancel.
 */
export function ExportSheet({
  trip,
  open,
  onClose,
}: {
  trip: TripDetailDto
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations()
  const router = useRouter()
  const appLocale = useLocale()
  const [lang, setLang] = useState<Lang>(appLocale === 'en' ? 'en' : 'th')
  const [format, setFormat] = useState<Format>('pdf')
  const [plan, setPlan] = useState(true)
  const [expenses, setExpenses] = useState(true)
  // PDF totals in the trip currency or any currency with a saved rate (Excel/CSV list both).
  const currencies = [
    trip.baseCurrency,
    ...Object.keys(trip.fxRates).filter(
      (code) => code !== trip.baseCurrency && usableRate(trip.fxRates, code),
    ),
  ]
  const [currency, setCurrency] = useState(trip.baseCurrency)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nothing = format === 'pdf' && !plan && !expenses

  async function excel() {
    const t = await translatorFor(lang)
    const [list, summary, pool] = await Promise.all([
      apiFetch(`/api/trips/${trip.id}/expenses`, { schema: z.array(ExpenseDto) }),
      apiFetch(`/api/trips/${trip.id}/expenses/summary`, { schema: ExpenseSummaryDto }),
      apiFetch(`/api/trips/${trip.id}/pool`, { schema: PoolDto }),
    ])
    await exportTripExcel(
      safeFileName(trip.name),
      list,
      summary,
      trip.members,
      {
        expenses: t('expenses.title'),
        people: t('expenses.people'),
        settle: t('expenses.settle'),
        columns: {
          date: t('export.col.date'),
          title: t('export.col.title'),
          category: t('export.col.category'),
          amount: t('export.col.amount'),
          currency: t('export.col.currency'),
          rate: t('export.col.rate'),
          base: t('export.col.base'),
          paidBy: t('export.col.paidBy'),
          split: t('export.col.split'),
          name: t('export.col.name'),
          paid: t('export.col.paid'),
          share: t('export.col.share'),
          net: t('export.col.net'),
          from: t('export.col.from'),
          to: t('export.col.to'),
        },
        category: (k) => t(`expenses.categories.${k}`),
        pool: t('expenses.form.pool'),
        poolSheet: {
          title: t('expenses.pool.title'),
          note: t('expenses.pool.note'),
          percent: '%',
          rule: t('expenses.pool.rule'),
          mode: t(`expenses.pool.modes.${pool.mode}`),
          putIn: t('expenses.pool.putIn'),
          spent: t('expenses.pool.spent'),
          left: t('expenses.pool.left'),
          byMember: t('expenses.pool.byMember'),
        },
      },
      pool,
    )
  }

  async function confirm() {
    if (nothing) return
    setBusy(true)
    setError(null)
    try {
      if (format === 'csv') {
        // A file download from the API, not a page: a temporary link with "download".
        const link = document.createElement('a')
        link.href = `/api/trips/${trip.id}/expenses.csv?lang=${lang}`
        link.download = ''
        link.click()
      } else if (format === 'excel') await excel()
      else {
        // The print page opens the system print dialog itself ("Save as PDF").
        router.push(printHref(trip.id, plan, expenses, lang, currency, true) as Route)
      }
      onClose()
    } catch {
      setError(t('errors.INTERNAL'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('export.title')}>
      <div className="space-y-4">
        <div role="radiogroup" aria-label={t('export.format')} className="grid gap-2">
          {FORMATS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={format === key}
              onClick={() => setFormat(key)}
              className={cn(
                'flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-left',
                format === key ? 'chip-on' : 'bg-card',
              )}
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              <span className="min-w-0">
                <span className="block font-semibold">{t(`export.formats.${key}`)}</span>
                <span className="block text-xs text-muted-foreground">
                  {t(`export.formatHints.${key}`)}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-sm text-muted-foreground">{t('export.language')}</p>
          <div
            role="radiogroup"
            aria-label={t('export.language')}
            className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
          >
            {(['th', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={lang === l}
                onClick={() => setLang(l)}
                className={cn(
                  'min-h-10 rounded-full text-sm font-semibold',
                  lang === l ? 'seg-on' : 'text-muted-foreground',
                )}
              >
                {l === 'th' ? 'ภาษาไทย' : 'English'}
              </button>
            ))}
          </div>
        </div>

        {format === 'pdf' && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm text-muted-foreground">{t('export.include')}</legend>
            {(
              [
                ['plan', plan, setPlan],
                ['expenses', expenses, setExpenses],
              ] as const
            ).map(([key, on, set]) => (
              <label
                key={key}
                className="flex min-h-12 items-start gap-3 rounded-2xl border px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => set(e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
                />
                <span>
                  <span className="block text-sm font-medium">{t(`export.sections.${key}`)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`export.sectionHints.${key}`)}
                  </span>
                </span>
              </label>
            ))}
            {nothing && <p className="text-sm text-danger">{t('export.pickOne')}</p>}
            {currencies.length > 1 && expenses && (
              <div>
                <p className="mb-1.5 text-sm text-muted-foreground">{t('export.currency')}</p>
                <div
                  role="radiogroup"
                  aria-label={t('export.currency')}
                  className="grid gap-1 rounded-full bg-muted p-1"
                  style={{ gridTemplateColumns: `repeat(${currencies.length}, minmax(0, 1fr))` }}
                >
                  {currencies.map((code) => (
                    <button
                      key={code}
                      type="button"
                      role="radio"
                      aria-checked={currency === code}
                      onClick={() => setCurrency(code)}
                      className={cn(
                        'min-h-10 rounded-full text-sm font-semibold',
                        currency === code ? 'seg-on' : 'text-muted-foreground',
                      )}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Same tab: the print page's back button returns here to the trip. */}
            <button
              type="button"
              disabled={nothing}
              onClick={() => {
                router.push(printHref(trip.id, plan, expenses, lang, currency) as Route)
                onClose()
              }}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-medium text-primary disabled:opacity-50"
            >
              <Eye aria-hidden className="size-4" />
              {t('export.preview')}
            </button>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={busy || nothing} onClick={() => void confirm()}>
            <Download aria-hidden className="size-4" />
            {t('export.confirm')}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
