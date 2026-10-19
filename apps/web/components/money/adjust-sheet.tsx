'use client'

import type { MonthLineDto } from '@iplan/contracts'
import { money, toDecimalString } from '@iplan/core'
import { formatMonth } from '@iplan/i18n'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { fmt } from '@/lib/expenses'
import { useFinanceMutations } from '@/lib/finance'
import { useFormat } from '@/lib/use-format'

/** Bottom sheet to fix one recurring line for one month (bonus, unpaid leave, skipped rent...). */
export function AdjustSheet({
  line,
  month,
  onClose,
}: {
  line: MonthLineDto
  month: string
  onClose: () => void
}) {
  const t = useTranslations()
  const f = useFormat()
  const { setOverride, clearOverride } = useFinanceMutations()
  const [amount, setAmount] = useState(toDecimalString(money(BigInt(line.amountMinor), 'THB')))
  const [note, setNote] = useState(line.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const busy = setOverride.isPending || clearOverride.isPending
  const fail = (e: unknown) =>
    setError(
      e instanceof ApiError
        ? (Object.values(e.fields)[0] ?? t(`errors.${e.code}`))
        : t('errors.INTERNAL'),
    )

  const save = (value: string | null) =>
    setOverride.mutate(
      { ruleId: line.ruleId, month, input: { amount: value, note: note.trim() || null } },
      { onSuccess: onClose, onError: fail },
    )

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="space-y-4 rounded-t-3xl bg-background px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-muted" />
        <div>
          <p className="text-sm text-muted-foreground">
            {t('finance.adjust.title', { month: formatMonth(month, { locale: f.locale }) })}
          </p>
          <p className="text-xl font-semibold">{line.name}</p>
          <p className="text-sm text-muted-foreground">
            {t('finance.planned', { amount: fmt(line.plannedMinor, 'THB') })}
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Field label={t('finance.adjust.amount')}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg font-semibold"
          />
        </Field>
        <Field label={t('finance.adjust.note')} hint={t('common.optional')}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </Field>
        <Button size="lg" disabled={busy} onClick={() => save(amount.replaceAll(',', ''))}>
          {t('finance.adjust.save')}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => save(null)}>
            {t('finance.adjust.skip')}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !line.overridden}
            onClick={() =>
              clearOverride.mutate(
                { ruleId: line.ruleId, month },
                { onSuccess: onClose, onError: fail },
              )
            }
          >
            {t('finance.adjust.reset')}
          </Button>
        </div>
        <Link href="/money/rules" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
          {t('finance.adjust.editAll')}
        </Link>
      </div>
    </div>
  )
}
