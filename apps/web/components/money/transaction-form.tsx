'use client'

import type { FinanceCategoryDto, TransactionDto } from '@iplan/contracts'
import { money, toDecimalString } from '@iplan/core'
import { Trash2 } from 'lucide-react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Attachments } from '@/components/attachments'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-fields'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { useCategoryName, useFinanceMutations } from '@/lib/finance'

export function TransactionForm({
  categories,
  transaction,
  defaultDate,
}: {
  categories: FinanceCategoryDto[]
  transaction?: TransactionDto
  defaultDate: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const categoryName = useCategoryName()
  const { saveTransaction, deleteTransaction } = useFinanceMutations()
  const [kind, setKind] = useState<'income' | 'expense'>(transaction?.kind ?? 'expense')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const backTo = (date: string) => `/money?month=${date.slice(0, 7)}` as Route

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (k: string) => String(form.get(k) ?? '').trim()
    const input = {
      kind,
      title: value('title'),
      amount: value('amount').replaceAll(',', ''),
      date: value('date'),
      categoryId: value('categoryId') || null,
      note: value('note') || null,
    }
    saveTransaction.mutate(
      { ...(transaction && { id: transaction.id }), input },
      {
        onSuccess: () => {
          router.push(backTo(input.date))
          router.refresh()
        },
        onError: (e) => {
          setErrors(e instanceof ApiError ? e.fields : {})
          setFormError(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`))
        },
      },
    )
  }

  async function onDelete() {
    if (!transaction || !window.confirm(t('common.confirmDelete'))) return
    await deleteTransaction.mutateAsync(transaction.id)
    router.push(backTo(transaction.date))
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 px-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
        role="radiogroup"
        aria-label={t('finance.tx.kind')}
      >
        {(['expense', 'income'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              'min-h-11 rounded-lg text-sm font-medium',
              kind === k ? 'bg-card shadow-sm' : 'text-muted-foreground',
            )}
          >
            {t(`finance.tx.${k}`)}
          </button>
        ))}
      </div>
      <Field label={t('finance.tx.title')} error={errors.title}>
        <Input
          name="title"
          required
          maxLength={80}
          defaultValue={transaction?.title}
          autoComplete="off"
        />
      </Field>
      <Field label={t('finance.tx.amount')} error={errors.amount}>
        <Input
          name="amount"
          inputMode="decimal"
          className="text-lg font-semibold tabular-nums"
          defaultValue={
            transaction ? toDecimalString(money(BigInt(transaction.amountMinor), 'THB')) : ''
          }
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('finance.tx.date')} error={errors.date}>
          <DateField
            name="date"
            label={t('finance.tx.date')}
            defaultValue={transaction?.date ?? defaultDate}
          />
        </Field>
        <Field label={t('finance.tx.category')} error={errors.categoryId}>
          <Select name="categoryId" defaultValue={transaction?.categoryId ?? ''}>
            <option value="">{t('finance.rule.none')}</option>
            {categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryName(c.name)}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      <Field label={t('finance.tx.note')} hint={t('common.optional')}>
        <Textarea name="note" rows={2} maxLength={500} defaultValue={transaction?.note ?? ''} />
      </Field>
      {transaction ? (
        <Attachments entityType="transaction" entityId={transaction.id} canEdit kind="slip" />
      ) : (
        <p className="text-sm text-muted-foreground">{t('attachments.saveFirst')}</p>
      )}
      <Button type="submit" size="lg" disabled={saveTransaction.isPending}>
        {t('common.save')}
      </Button>
      {transaction && (
        <Button variant="ghost" size="lg" className="text-danger" onClick={onDelete}>
          <Trash2 aria-hidden className="size-4" />
          {t('common.delete')}
        </Button>
      )}
    </form>
  )
}
