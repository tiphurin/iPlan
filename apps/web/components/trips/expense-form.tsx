'use client'

import {
  ExpenseCategory,
  type ExpenseDto,
  type ExpenseInput,
  POOL_ID,
  type SplitMode,
  type TripDetailDto,
  type TripItemDto,
} from '@iplan/contracts'
import { convertMoney, money, parseMoney, toDecimalString } from '@iplan/core'
import { Trash2 } from 'lucide-react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Attachments } from '@/components/attachments'
import { CATEGORY_COLORS } from '@/components/charts/donut'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { fmt, useExpenseMutations } from '@/lib/expenses'
import { tripDays } from '@/lib/trip-dates'
import { useFormat } from '@/lib/use-format'

const tryParse = (value: string, currency: string) => {
  try {
    return parseMoney(value || '0', currency).amount
  } catch {
    return null
  }
}

export function ExpenseForm({
  trip,
  items,
  expense,
  defaultDay,
}: {
  trip: TripDetailDto
  items: TripItemDto[]
  expense?: ExpenseDto
  defaultDay: string
}) {
  const t = useTranslations()
  const f = useFormat()
  const router = useRouter()
  const { save, remove } = useExpenseMutations(trip.id)
  const base = trip.baseCurrency
  const members = trip.members
  const decimal = (minor: string, code: string) => toDecimalString(money(BigInt(minor), code))

  const [currency, setCurrency] = useState(expense?.currency ?? base)
  const [amount, setAmount] = useState(
    expense ? decimal(expense.amountMinor, expense.currency) : '',
  )
  const [rate, setRate] = useState(expense?.fxRate ?? trip.fxRates[currency] ?? '')
  const [mode, setMode] = useState<SplitMode>(expense?.splitMode ?? 'equal')
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'food')
  const [day, setDay] = useState(expense?.dayDate ?? defaultDay)
  const [participants, setParticipants] = useState<string[]>(
    expense?.splitMode === 'equal'
      ? expense.shares.map((s) => s.userId)
      : members.map((m) => m.userId),
  )
  const [exact, setExact] = useState<Record<string, string>>(
    Object.fromEntries(
      members.map((m) => {
        const share =
          expense?.splitMode === 'exact'
            ? expense.shares.find((s) => s.userId === m.userId)
            : undefined
        return [m.userId, share ? decimal(share.amountMinor, expense?.currency ?? base) : '']
      }),
    ),
  )
  const [percent, setPercent] = useState<Record<string, string>>(
    Object.fromEntries(
      members.map((m) => {
        const share =
          expense?.splitMode === 'percent'
            ? expense.shares.find((s) => s.userId === m.userId)
            : undefined
        return [m.userId, typeof share?.percentBp === 'number' ? String(share.percentBp / 100) : '']
      }),
    ),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const total = tryParse(amount, currency)
  const effectiveRate = currency === base ? '1' : rate
  let converted: string | null = null
  if (total !== null && total > 0n && currency !== base && /^\d+(\.\d+)?$/.test(effectiveRate)) {
    converted = fmt(
      convertMoney(money(total, currency), { from: currency, to: base, rate: effectiveRate })
        .amount,
      base,
    )
  }
  const exactSum = Object.values(exact).reduce((sum, v) => sum + (tryParse(v, currency) ?? 0n), 0n)
  const percentSum = Object.values(percent).reduce((sum, v) => sum + (Number(v) || 0), 0)
  const currencies = [...new Set([base, ...Object.keys(trip.fxRates), currency])]
  const dayItems = items.filter((i) => i.dayDate === day)

  function changeCurrency(code: string) {
    setCurrency(code)
    setRate(trip.fxRates[code] ?? '')
  }

  function presetPercent(values: number[]) {
    setPercent(Object.fromEntries(members.map((m, i) => [m.userId, String(values[i] ?? 0)])))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const split: ExpenseInput['split'] =
      mode === 'equal'
        ? { mode, participants }
        : mode === 'exact'
          ? { mode, shares: Object.fromEntries(Object.entries(exact).filter(([, v]) => v.trim())) }
          : {
              mode,
              shares: Object.fromEntries(
                Object.entries(percent)
                  .filter(([, v]) => v.trim())
                  .map(([k, v]) => [k, Number(v)]),
              ),
            }
    const input: ExpenseInput = {
      title: String(form.get('title') ?? ''),
      amount: amount.replaceAll(',', ''),
      currency,
      ...(currency !== base && rate ? { fxRate: rate } : {}),
      paidBy: String(form.get('paidBy')),
      category,
      dayDate: day,
      itemId: String(form.get('itemId') ?? '') || null,
      note: String(form.get('note') ?? '').trim() || null,
      split,
    }
    setErrors({})
    setFormError(null)
    try {
      await save.mutateAsync(expense ? { id: expense.id, input } : { input })
      router.push(`/trips/${trip.id}/expenses` as Route)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields)
        setFormError(t(`errors.${error.code}`))
      } else setFormError(t('errors.INTERNAL'))
    }
  }

  async function onDelete() {
    if (!expense || !window.confirm(t('common.confirmDelete'))) return
    await remove.mutateAsync(expense.id)
    router.push(`/trips/${trip.id}/expenses` as Route)
    router.refresh()
  }

  const remaining = total === null ? null : total - exactSum

  return (
    <form onSubmit={onSubmit} className="space-y-4 px-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <Field label={t('expenses.form.title')} error={errors.title}>
        <Input
          name="title"
          required
          maxLength={120}
          defaultValue={expense?.title}
          autoComplete="off"
        />
      </Field>

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label={t('expenses.form.amount')} error={errors.amount}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg font-semibold tabular-nums"
          />
        </Field>
        <Field label={t('expenses.form.currency')}>
          <Select value={currency} onChange={(e) => changeCurrency(e.target.value)}>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      {currency !== base && (
        <Field label={t('expenses.form.rate', { code: currency, base })} error={errors.fxRate}>
          <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
      )}
      {converted && (
        <p className="-mt-2 text-sm text-muted-foreground">
          {t('expenses.form.converted', { amount: converted })}
        </p>
      )}

      <Field label={t('expenses.form.paidBy')} error={errors.paidBy}>
        <Select name="paidBy" defaultValue={expense?.paidBy ?? members[0]?.userId}>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
          <option value={POOL_ID}>{t('expenses.form.pool')}</option>
        </Select>
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">{t('expenses.form.split')}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {(['equal', 'exact', 'percent'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'min-h-11 rounded-lg text-sm font-medium',
                mode === m ? 'bg-card shadow-sm' : 'text-muted-foreground',
              )}
            >
              {t(`expenses.form.${m}`)}
            </button>
          ))}
        </div>

        <ul className="divide-y rounded-2xl border bg-card">
          {members.map((m) => (
            <li key={m.userId} className="flex min-h-12 items-center gap-3 px-4 py-1.5">
              {mode === 'equal' ? (
                <label className="flex flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--primary)]"
                    checked={participants.includes(m.userId)}
                    onChange={(e) =>
                      setParticipants((list) =>
                        e.target.checked
                          ? [...list, m.userId]
                          : list.filter((id) => id !== m.userId),
                      )
                    }
                  />
                  <span className="flex-1">{m.name}</span>
                  {participants.includes(m.userId) && total !== null && participants.length > 0 && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {fmt(total / BigInt(participants.length), currency)}
                    </span>
                  )}
                </label>
              ) : (
                <>
                  <span className="flex-1">{m.name}</span>
                  <Input
                    aria-label={m.name}
                    inputMode="decimal"
                    className="w-28 text-right tabular-nums"
                    value={(mode === 'exact' ? exact : percent)[m.userId] ?? ''}
                    onChange={(e) =>
                      (mode === 'exact' ? setExact : setPercent)((v) => ({
                        ...v,
                        [m.userId]: e.target.value,
                      }))
                    }
                  />
                  <span className="w-8 text-sm text-muted-foreground">
                    {mode === 'percent' ? '%' : currency}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        {mode === 'exact' && remaining !== null && remaining !== 0n && (
          <p className={cn('text-sm', remaining < 0n ? 'text-danger' : 'text-muted-foreground')}>
            {remaining > 0n
              ? t('expenses.form.remaining', { amount: fmt(remaining, currency) })
              : t('expenses.form.over', { amount: fmt(-remaining, currency) })}
          </p>
        )}
        {mode === 'percent' && (
          <div className="flex flex-wrap items-center gap-2">
            {members.length === 2 &&
              [
                [50, 50],
                [60, 40],
                [70, 30],
              ].map((preset) => (
                <Button
                  key={preset.join()}
                  variant="secondary"
                  onClick={() => presetPercent(preset)}
                >
                  {preset.join('/')}
                </Button>
              ))}
            <span
              className={cn('ml-auto text-sm tabular-nums', percentSum !== 100 && 'text-danger')}
            >
              {percentSum}%
            </span>
          </div>
        )}
        {errors.split && <p className="text-sm text-danger">{errors.split}</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{t('expenses.form.category')}</legend>
        <div className="flex flex-wrap gap-2">
          {ExpenseCategory.options.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                'flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm',
                category === c ? 'border-primary bg-primary/10 font-medium' : 'bg-card',
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[c] }}
              />
              {t(`expenses.categories.${c}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('expenses.form.day')} error={errors.dayDate}>
          <Select value={day} onChange={(e) => setDay(e.target.value)}>
            {tripDays(trip.startDate, trip.endDate).map((d) => (
              <option key={d} value={d}>
                {f.day(d)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('expenses.form.item')} error={errors.itemId}>
          <Select name="itemId" defaultValue={expense?.itemId ?? ''}>
            <option value="">{t('expenses.form.none')}</option>
            {dayItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label={t('expenses.form.note')} hint={t('common.optional')}>
        <Textarea name="note" rows={2} maxLength={500} defaultValue={expense?.note ?? ''} />
      </Field>

      {expense ? (
        <Attachments entityType="expense" entityId={expense.id} canEdit kind="slip" />
      ) : (
        <p className="text-sm text-muted-foreground">{t('attachments.saveFirst')}</p>
      )}

      <Button type="submit" size="lg" disabled={save.isPending}>
        {t('common.save')}
      </Button>
      {expense && (
        <Button
          variant="ghost"
          size="lg"
          className="text-danger"
          onClick={onDelete}
          disabled={remove.isPending}
        >
          <Trash2 aria-hidden className="size-4" />
          {t('common.delete')}
        </Button>
      )}
    </form>
  )
}
