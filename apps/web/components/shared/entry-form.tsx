'use client'

import {
  LedgerCategory,
  type LedgerDetailDto,
  type LedgerEntryDto,
  type SplitInput,
} from '@iplan/contracts'
import {
  type Shares,
  money,
  parseMoney,
  splitEqual,
  splitExact,
  splitPercent,
  toDecimalString,
} from '@iplan/core'
import { todayKey } from '@iplan/i18n'
import { Trash2 } from 'lucide-react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { BackLink } from '@/components/back-link'
import { Button } from '@/components/ui/button'
import { Chip, Segmented } from '@/components/ui/chip'
import { DateField } from '@/components/ui/date-fields'
import { Field, Input, Textarea } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { fmt } from '@/lib/expenses'
import { LEDGER_CATEGORY_COLORS, useLedgerMutations } from '@/lib/ledgers'

type Mode = SplitInput['mode']
const PERCENT_PRESETS = [50, 60, 70, 75] as const

function major(minor: bigint, currency: string): string {
  return toDecimalString(money(minor, currency))
}

/**
 * Add or edit a shared cost. Defaults to "I paid, split equally"; "custom"
 * covers cases like a 2,000 dinner where the payer chooses to cover 1,500.
 */
export function EntryForm({
  ledger,
  meId,
  entry,
}: {
  ledger: LedgerDetailDto
  meId: string
  entry?: LedgerEntryDto
}) {
  const t = useTranslations()
  const router = useRouter()
  const m = useLedgerMutations(ledger.id)
  const cur = ledger.currency
  const members = ledger.members
  const ids = members.map((x) => x.userId)
  const nameOf = (id: string) =>
    id === meId ? t('shared.you') : (members.find((x) => x.userId === id)?.name ?? '—')

  const [amount, setAmount] = useState(entry ? major(BigInt(entry.amountMinor), cur) : '')
  const [title, setTitle] = useState(entry?.title ?? '')
  const [category, setCategory] = useState<LedgerCategory>(entry?.category ?? 'food')
  const [date, setDate] = useState(entry?.date ?? todayKey('Asia/Bangkok'))
  const [paidBy, setPaidBy] = useState(entry?.paidBy ?? meId)
  const [mode, setMode] = useState<Mode>(entry?.splitMode ?? 'equal')
  const [participants, setParticipants] = useState<string[]>(
    entry?.splitMode === 'equal' ? entry.shares.map((s) => s.userId) : ids,
  )
  const [exact, setExact] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ids.map((id) => {
        const share = entry?.shares.find((s) => s.userId === id)
        return [
          id,
          entry?.splitMode === 'exact' && share ? major(BigInt(share.amountMinor), cur) : '',
        ]
      }),
    ),
  )
  const [percent, setPercent] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ids.map((id) => {
        const share = entry?.shares.find((s) => s.userId === id)
        return [id, share && share.percentBp !== null ? String(share.percentBp / 100) : '']
      }),
    ),
  )
  const [note, setNote] = useState(entry?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})

  const total = useMemo(() => {
    try {
      const value = parseMoney(amount || '0', cur).amount
      return value > 0n ? value : null
    } catch {
      return null
    }
  }, [amount, cur])

  /** Live result of the split, or the reason it doesn't work yet. */
  const preview = useMemo((): { shares: Shares } | { problem: string } | null => {
    if (total === null) return null
    try {
      if (mode === 'equal') return { shares: splitEqual(total, participants) }
      if (mode === 'exact') {
        const parts = Object.fromEntries(
          Object.entries(exact)
            .filter(([, v]) => v.trim() !== '')
            .map(([id, v]) => [id, parseMoney(v, cur).amount]),
        )
        const sum = Object.values(parts).reduce((a, b) => a + b, 0n)
        if (sum !== total) {
          return {
            problem:
              sum < total
                ? t('shared.leftToAssign', { amount: fmt(total - sum, cur) })
                : t('shared.overAssigned', { amount: fmt(sum - total, cur) }),
          }
        }
        return { shares: splitExact(total, parts) }
      }
      const bp = Object.fromEntries(
        Object.entries(percent)
          .filter(([, v]) => v.trim() !== '')
          .map(([id, v]) => [id, Math.round(Number(v) * 100)]),
      )
      const sum = Object.values(bp).reduce((a, b) => a + b, 0)
      if (sum !== 10000) return { problem: t('shared.percentMust', { sum: sum / 100 }) }
      return { shares: splitPercent(total, bp) }
    } catch {
      return { problem: t('shared.checkSplit') }
    }
  }, [total, mode, participants, exact, percent, cur, t])

  /** With two people, typing one share fills in the other. */
  function setExactFor(id: string, value: string) {
    const next = { ...exact, [id]: value }
    if (ids.length === 2 && total !== null) {
      const other = ids.find((x) => x !== id) as string
      try {
        const mine = parseMoney(value || '0', cur).amount
        if (mine >= 0n && mine <= total) next[other] = major(total - mine, cur)
      } catch {
        // Leave the other share alone while the input is mid-typing.
      }
    }
    setExact(next)
  }

  function setPercentFor(id: string, value: string) {
    const next = { ...percent, [id]: value }
    const n = Number(value)
    if (ids.length === 2 && value.trim() !== '' && n >= 0 && n <= 100) {
      next[ids.find((x) => x !== id) as string] = String(Math.round((100 - n) * 100) / 100)
    }
    setPercent(next)
  }

  function splitInput(): SplitInput {
    if (mode === 'equal') return { mode, participants }
    if (mode === 'exact') {
      return {
        mode,
        shares: Object.fromEntries(Object.entries(exact).filter(([, v]) => v.trim() !== '')),
      }
    }
    return {
      mode,
      shares: Object.fromEntries(
        Object.entries(percent)
          .filter(([, v]) => v.trim() !== '')
          .map(([id, v]) => [id, Number(v)]),
      ),
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFields({})
    const body = {
      title: title.trim() || t(`shared.categories.${category}`),
      category,
      amount,
      date,
      paidBy,
      split: splitInput(),
      note: note.trim() || null,
    }
    try {
      if (entry) await m.updateEntry.mutateAsync({ id: entry.id, ...body })
      else await m.addEntry.mutateAsync(body)
      router.replace(`/shared/${ledger.id}` as Route)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields ?? {})
        setError(t(`errors.${err.code}`))
      } else setError(t('errors.INTERNAL'))
    }
  }

  async function onDelete() {
    if (!entry || !window.confirm(t('common.confirmDelete'))) return
    await m.deleteEntry.mutateAsync(entry.id)
    router.replace(`/shared/${ledger.id}` as Route)
    router.refresh()
  }

  const busy = m.addEntry.isPending || m.updateEntry.isPending
  const other = ids.find((x) => x !== paidBy)

  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-6">
        <BackLink href={`/shared/${ledger.id}` as Route} label={ledger.name} />
      </div>
      <h1 className="px-4 pb-3 text-[28px] font-bold">
        {entry ? t('shared.editCost') : t('shared.addCost')}
      </h1>
      <form onSubmit={onSubmit} className="space-y-5 px-4 md:max-w-xl" noValidate>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Field label={t('shared.amount')} error={fields.amount}>
          <Input
            inputMode="decimal"
            autoFocus={!entry}
            placeholder="0.00"
            className="num h-16 text-3xl"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </Field>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
          {LedgerCategory.options.map((c) => (
            <Chip key={c} pressed={category === c} onClick={() => setCategory(c)}>
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: LEDGER_CATEGORY_COLORS[c] }}
              />
              {t(`shared.categories.${c}`)}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label={t('shared.what')} error={fields.title}>
            <Input
              value={title}
              maxLength={120}
              placeholder={t(`shared.categories.${category}`)}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label={t('shared.date')} error={fields.date}>
            <DateField label={t('shared.date')} value={date} onChange={setDate} />
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm text-muted-foreground">{t('shared.whoPaid')}</legend>
          <div className="flex flex-wrap gap-2">
            {members.map((x) => (
              <Chip
                key={x.userId}
                pressed={paidBy === x.userId}
                onClick={() => setPaidBy(x.userId)}
              >
                {nameOf(x.userId)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm text-muted-foreground">{t('shared.howSplit')}</legend>
          <Segmented
            label={t('shared.howSplit')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'equal', label: t('shared.modeEqual') },
              { value: 'exact', label: t('shared.modeExact') },
              { value: 'percent', label: t('shared.modePercent') },
            ]}
          />
          {mode === 'equal' && (
            <div className="flex flex-wrap gap-2">
              {members.map((x) => {
                const on = participants.includes(x.userId)
                return (
                  <Chip
                    key={x.userId}
                    pressed={on}
                    onClick={() =>
                      setParticipants(
                        on
                          ? participants.filter((p) => p !== x.userId)
                          : [...participants, x.userId],
                      )
                    }
                  >
                    {nameOf(x.userId)}
                  </Chip>
                )
              })}
            </div>
          )}
          {mode === 'exact' && (
            <div className="space-y-2">
              {total !== null && other && (
                <div className="flex flex-wrap gap-2">
                  <Chip onClick={() => setExactFor(paidBy, major(total, cur))}>
                    {t('shared.paysAll', { name: nameOf(paidBy) })}
                  </Chip>
                  <Chip onClick={() => setExactFor(other, major(total, cur))}>
                    {t('shared.paysAll', { name: nameOf(other) })}
                  </Chip>
                </div>
              )}
              {members.map((x) => (
                <label key={x.userId} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate">{nameOf(x.userId)}</span>
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    className="num"
                    value={exact[x.userId] ?? ''}
                    onChange={(e) => setExactFor(x.userId, e.target.value.replace(/[^\d.]/g, ''))}
                  />
                </label>
              ))}
            </div>
          )}
          {mode === 'percent' && (
            <div className="space-y-2">
              {other && (
                <div className="flex flex-wrap gap-2">
                  {PERCENT_PRESETS.map((p) => (
                    <Chip
                      key={p}
                      pressed={percent[paidBy] === String(p)}
                      onClick={() => setPercentFor(paidBy, String(p))}
                    >
                      {p}/{100 - p}
                    </Chip>
                  ))}
                </div>
              )}
              {members.map((x) => (
                <label key={x.userId} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate">{nameOf(x.userId)}</span>
                  <Input
                    inputMode="decimal"
                    placeholder="0"
                    className="num"
                    value={percent[x.userId] ?? ''}
                    onChange={(e) => setPercentFor(x.userId, e.target.value.replace(/[^\d.]/g, ''))}
                  />
                  <span className="text-muted-foreground">%</span>
                </label>
              ))}
            </div>
          )}
          {fields.split && <p className="text-sm text-danger">{fields.split}</p>}
        </fieldset>

        {preview && (
          <div className="rounded-2xl border bg-card p-4" aria-live="polite">
            {'problem' in preview ? (
              <p className="text-sm font-medium text-warning">{preview.problem}</p>
            ) : (
              <ul className="space-y-1 text-[15px]">
                {Object.entries(preview.shares).map(([id, share]) => (
                  <li key={id} className="flex justify-between gap-3">
                    <span>
                      {id === paidBy
                        ? t('shared.previewPayer', { name: nameOf(id) })
                        : t('shared.previewOwes', { name: nameOf(id), payer: nameOf(paidBy) })}
                    </span>
                    <span className="num">{fmt(share, cur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Field label={t('shared.note')} hint={t('common.optional')}>
          <Textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <Button type="submit" size="lg" disabled={busy || !preview || 'problem' in preview}>
          {t('common.save')}
        </Button>
        {entry && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="text-danger"
            onClick={onDelete}
          >
            <Trash2 aria-hidden className="size-4" />
            {t('common.delete')}
          </Button>
        )}
      </form>
    </>
  )
}
