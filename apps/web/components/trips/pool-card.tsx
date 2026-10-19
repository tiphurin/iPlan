'use client'

import type {
  PoolContributionDto,
  PoolContributionInput,
  PoolDto,
  PoolMode,
  TripDetailDto,
} from '@iplan/contracts'
import { convertMoney, money, parseMoney, toDecimalString } from '@iplan/core'
import { todayKey } from '@iplan/i18n'
import { ChevronRight, Landmark, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/chip'
import { DateField } from '@/components/ui/date-fields'
import { Field, Input, Select } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'
import { Sheet } from '@/components/ui/sheet'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { confirmDialog } from '@/lib/confirm'
import { poolHeadline } from '@/lib/expense-charts'
import { fmt, usePoolMutations } from '@/lib/expenses'
import { useFormat } from '@/lib/use-format'

const MODES: readonly PoolMode[] = ['actual', 'proportional']

/**
 * The shared pool: what went in, what it spent, what is left, who put in how
 * much and the rule for sharing its spending. `compact` is the settle-tab summary.
 */
export function PoolCard({
  trip,
  pool,
  meId,
  compact = false,
}: {
  trip: TripDetailDto
  pool: PoolDto
  meId: string | null
  compact?: boolean
}) {
  const t = useTranslations()
  const f = useFormat()
  const mutations = usePoolMutations(trip.id)
  const canEdit = trip.role !== 'viewer'
  const base = pool.baseCurrency
  const [editing, setEditing] = useState<PoolContributionDto | 'new' | null>(null)
  const leftover = BigInt(pool.leftoverBaseMinor)
  const total = BigInt(pool.totalBaseMinor)
  const spent = BigInt(pool.spentBaseMinor)
  const imageOf = (id: string) => trip.members.find((m) => m.userId === id)?.image ?? null

  const headline = poolHeadline(pool.byMember)
  const who = (p: { userId: string; name: string }, object = false) =>
    p.userId === meId ? t(object ? 'expenses.pool.youObject' : 'expenses.pool.you') : p.name
  const headlineText =
    headline.kind === 'empty'
      ? t('expenses.pool.headline.empty')
      : headline.kind === 'equal'
        ? t('expenses.pool.headline.equal')
        : headline.kind === 'only'
          ? t('expenses.pool.headline.only', { name: who(headline) })
          : t(headline.most ? 'expenses.pool.headline.most' : 'expenses.pool.headline.more', {
              who: who(headline.top),
              other: who(headline.other, true),
              amount: fmt(headline.diffMinor, base),
            })
  const leftText =
    leftover >= 0n
      ? t('expenses.pool.leftAmount', { amount: fmt(leftover, base) })
      : t('expenses.pool.shortAmount', { amount: fmt(-leftover, base) })

  if (compact) {
    return (
      <Card className="flex items-start gap-3">
        <PoolIcon size={34} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-semibold">
            {t('expenses.pool.title')} · {headlineText}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {t('expenses.pool.summary', { in: fmt(total, base), spent: fmt(spent, base) })} ·{' '}
            <span className={cn(leftover < 0n && 'font-semibold text-danger')}>{leftText}</span>
          </p>
          <p className="text-xs text-faint">{t(`expenses.pool.modes.${pool.mode}`)}</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="space-y-4" aria-labelledby="pool-title">
      <div className="flex items-center gap-3">
        <PoolIcon size={40} />
        <div className="min-w-0 flex-1">
          <h2 id="pool-title" className="text-lg font-semibold">
            {t('expenses.pool.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{headlineText}</p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label={t('expenses.pool.putIn')} value={fmt(total, base)} />
        <Stat label={t('expenses.pool.spent')} value={fmt(spent, base)} />
        <Stat
          label={leftover >= 0n ? t('expenses.pool.left') : t('expenses.pool.short')}
          value={fmt(leftover >= 0n ? leftover : -leftover, base)}
          tone={leftover < 0n ? 'danger' : 'success'}
        />
      </dl>
      {total > 0n && (
        <Progress
          value={Number(spent) / Number(total)}
          {...(leftover < 0n && { color: 'var(--danger)' })}
        />
      )}

      {pool.byMember.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="text-sm font-semibold">{t('expenses.pool.byMember')}</h3>
          <ul className="space-y-2.5">
            {pool.byMember.map((m) => (
              <li key={m.userId} className="flex items-center gap-3">
                <Avatar name={m.name} image={imageOf(m.userId)} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {fmt(m.contributedBaseMinor, base)}
                    </span>
                    <span className="w-12 shrink-0 text-right text-muted-foreground tabular-nums">
                      {(m.percentBp / 100).toFixed(1)}%
                    </span>
                  </span>
                  <Progress value={m.percentBp / 10_000} className="mt-1 h-1.5" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t('expenses.pool.rule')}</h3>
        {canEdit && (
          <Segmented
            label={t('expenses.pool.rule')}
            value={pool.mode}
            onChange={(mode) => mode !== pool.mode && mutations.mode.mutate(mode)}
            options={MODES.map((mode) => ({
              value: mode,
              label: t(`expenses.pool.modesShort.${mode}`),
            }))}
          />
        )}
        <ul className="space-y-1.5">
          {MODES.filter((mode) => canEdit || mode === pool.mode).map((mode) => (
            <li
              key={mode}
              className={cn('text-sm', mode === pool.mode ? 'text-foreground' : 'text-faint')}
            >
              <span className="font-semibold">{t(`expenses.pool.modes.${mode}`)}</span>
              {' — '}
              {t(`expenses.pool.explain.${mode}`)}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t('expenses.pool.contributions')}</h3>
        {pool.contributions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('expenses.pool.empty')}</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {pool.contributions.map((c) => {
              const body = (
                <>
                  <Avatar name={c.name} image={imageOf(c.userId)} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {f.day(c.date)}
                      {c.note ? ` · ${c.note}` : ''}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block text-sm font-semibold">
                      {fmt(c.amountMinor, c.currency)}
                    </span>
                    {c.currency !== base && (
                      <span className="block text-xs text-muted-foreground">
                        {fmt(c.baseAmountMinor, base)}
                      </span>
                    )}
                  </span>
                </>
              )
              return (
                <li key={c.id}>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left active:bg-muted"
                    >
                      {body}
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />
                    </button>
                  ) : (
                    <div className="flex min-h-14 items-center gap-3 px-3 py-2">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {canEdit ? (
          <Button variant="secondary" size="lg" onClick={() => setEditing('new')}>
            <Plus aria-hidden className="size-4" />
            {t('expenses.pool.add')}
          </Button>
        ) : (
          <p className="text-xs text-faint">{t('expenses.pool.readOnly')}</p>
        )}
      </section>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t('expenses.pool.addTitle') : t('expenses.pool.editTitle')}
      >
        {editing !== null && (
          <ContributionForm
            key={editing === 'new' ? 'new' : editing.id}
            trip={trip}
            base={base}
            meId={meId}
            contribution={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </Card>
  )
}

function PoolIcon({ size }: { size: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
      style={{ width: size, height: size }}
    >
      <Landmark className="size-[55%]" />
    </span>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'danger' | 'success'
}) {
  return (
    <div className="rounded-xl bg-muted px-1.5 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-sm leading-tight font-semibold tabular-nums [overflow-wrap:anywhere]',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function ContributionForm({
  trip,
  base,
  meId,
  contribution,
  onDone,
}: {
  trip: TripDetailDto
  base: string
  meId: string | null
  contribution?: PoolContributionDto | undefined
  onDone: () => void
}) {
  const t = useTranslations()
  const { save, remove } = usePoolMutations(trip.id)
  const members = trip.members
  const isMember = (id: string) => members.some((m) => m.userId === id)
  const [userId, setUserId] = useState(
    contribution?.userId ?? (meId && isMember(meId) ? meId : (members[0]?.userId ?? '')),
  )
  const [currency, setCurrency] = useState(contribution?.currency ?? base)
  const [amount, setAmount] = useState(
    contribution
      ? toDecimalString(money(BigInt(contribution.amountMinor), contribution.currency))
      : '',
  )
  const [rate, setRate] = useState(contribution?.fxRate ?? trip.fxRates[currency] ?? '')
  const [date, setDate] = useState(contribution?.date ?? todayKey(trip.homeTimeZone))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const currencies = [...new Set([base, ...Object.keys(trip.fxRates), currency])]

  let converted: string | null = null
  try {
    const value = parseMoney(amount.replaceAll(',', '') || '0', currency).amount
    if (value > 0n && currency !== base && /^\d+(\.\d+)?$/.test(rate)) {
      converted = fmt(
        convertMoney(money(value, currency), { from: currency, to: base, rate }).amount,
        base,
      )
    }
  } catch {
    converted = null
  }

  function fail(error: unknown) {
    if (error instanceof ApiError) {
      setErrors(error.fields)
      setFormError(t(`errors.${error.code}`))
    } else setFormError(t('errors.INTERNAL'))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input: PoolContributionInput = {
      userId,
      amount: amount.replaceAll(',', '').trim(),
      currency,
      ...(currency !== base && rate ? { fxRate: rate } : {}),
      date,
      note: String(form.get('note') ?? '').trim() || null,
    }
    setErrors({})
    setFormError(null)
    try {
      await save.mutateAsync(contribution ? { id: contribution.id, input } : { input })
      onDone()
    } catch (error) {
      fail(error)
    }
  }

  async function onDelete() {
    if (!contribution) return
    if (!(await confirmDialog(t('expenses.pool.confirmDelete'), { danger: true }))) return
    try {
      await remove.mutateAsync(contribution.id)
      onDone()
    } catch (error) {
      fail(error)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <Field label={t('expenses.pool.who')} error={errors.userId}>
        <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
          {contribution && !isMember(contribution.userId) && (
            <option value={contribution.userId}>{contribution.name}</option>
          )}
        </Select>
      </Field>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label={t('expenses.form.amount')} error={errors.amount}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg font-semibold tabular-nums"
            autoComplete="off"
          />
        </Field>
        <Field label={t('expenses.form.currency')} error={errors.currency}>
          <Select
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value)
              setRate(trip.fxRates[e.target.value] ?? '')
            }}
          >
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
      <Field label={t('expenses.pool.date')} error={errors.date}>
        <DateField label={t('expenses.pool.date')} value={date} onChange={setDate} />
      </Field>
      <Field label={t('expenses.pool.note')} hint={t('common.optional')} error={errors.note}>
        <Input
          noLeadingSpace
          name="note"
          maxLength={500}
          defaultValue={contribution?.note ?? ''}
          autoComplete="off"
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="flex-1" disabled={save.isPending}>
          {t('common.save')}
        </Button>
        {contribution && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="w-auto px-5 text-danger"
            onClick={() => void onDelete()}
            disabled={remove.isPending}
          >
            <Trash2 aria-hidden className="size-4" />
            {t('common.delete')}
          </Button>
        )}
      </div>
    </form>
  )
}
