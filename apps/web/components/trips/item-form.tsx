'use client'

import type { TripDetailDto, TripItemDetails, TripItemDto, TripItemKind } from '@iplan/contracts'
import { fromLocalInput, isValidTimeZone, toLocalInput } from '@iplan/core'
import { Copy, Trash2 } from 'lucide-react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { ITEM_KINDS, KIND_STYLE } from '@/lib/item-kinds'
import { TIME_ZONES, zoneLabel } from '@/lib/time-zones'
import { tripDays } from '@/lib/trip-dates'
import { useItemMutations } from '@/lib/trips'
import { useFormat } from '@/lib/use-format'

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim()

const DETAIL_FIELDS = [
  'address',
  'phone',
  'url',
  'hours',
  'line',
  'lineColor',
  'flightNumber',
] as const

export function ItemForm({
  trip,
  item,
  defaultDay,
  defaultTimeZone,
}: {
  trip: TripDetailDto
  item?: TripItemDto
  defaultDay: string
  defaultTimeZone: string
}) {
  const t = useTranslations()
  const f = useFormat()
  const router = useRouter()
  const mutations = useItemMutations(trip.id)
  const [kind, setKind] = useState<TripItemKind>(item?.kind ?? 'place')
  const [zone, setZone] = useState(item?.timeZone ?? defaultTimeZone)
  const [arrivalZone, setArrivalZone] = useState(item?.details.arrivalTimeZone ?? zone)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const busy = Object.values(mutations).some((m) => m.isPending)
  const zones = [...new Set<string>([...TIME_ZONES, zone, arrivalZone, trip.homeTimeZone])].filter(
    isValidTimeZone,
  )
  const endZone = kind === 'flight' ? arrivalZone : zone
  const backToDay = `/trips/${trip.id}?day=${item?.dayDate ?? defaultDay}` as Route

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const problems: Record<string, string> = {}
    let startsAt: Date | null = null
    let endsAt: Date | null = null
    try {
      startsAt = fromLocalInput(text(form, 'start'), zone)
    } catch {
      problems.startsAt = t('errors.VALIDATION_FAILED')
    }
    if (text(form, 'end')) {
      try {
        endsAt = fromLocalInput(text(form, 'end'), endZone)
      } catch {
        problems.endsAt = t('errors.VALIDATION_FAILED')
      }
    }
    if (Object.keys(problems).length > 0 || !startsAt) {
      setErrors(problems)
      return
    }

    // Start from stored extras (unknown keys survive), then apply the form's fields.
    const managed = new Set<string>([...DETAIL_FIELDS, 'arrivalTimeZone'])
    const details: TripItemDetails = Object.fromEntries(
      Object.entries(item?.details ?? {}).filter(([key]) => !managed.has(key)),
    )
    for (const key of DETAIL_FIELDS) {
      const value = text(form, key)
      if (value) details[key] = value
    }
    if (kind === 'flight' && arrivalZone !== zone) details.arrivalTimeZone = arrivalZone

    const input = {
      kind,
      title: text(form, 'title'),
      dayDate: text(form, 'dayDate'),
      timeZone: zone,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt?.toISOString() ?? null,
      notes: text(form, 'notes') || null,
      details,
    }
    setErrors({})
    setFormError(null)
    try {
      if (item) await mutations.update.mutateAsync({ id: item.id, ...input })
      else await mutations.create.mutateAsync(input)
      router.push(`/trips/${trip.id}?day=${input.dayDate}` as Route)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields)
        setFormError(t(`errors.${error.code}`))
      } else setFormError(t('errors.INTERNAL'))
    }
  }

  async function onDuplicate() {
    if (!item) return
    await mutations.duplicate.mutateAsync(item.id)
    router.push(backToDay)
    router.refresh()
  }

  async function onDelete() {
    if (!item || !window.confirm(t('common.confirmDelete'))) return
    await mutations.remove.mutateAsync(item.id)
    router.push(backToDay)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 px-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{t('item.kind')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {ITEM_KINDS.map((k) => {
            const { icon: Icon, tone } = KIND_STYLE[k]
            return (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium',
                  kind === k ? 'border-primary ring-2 ring-primary/20' : 'bg-card',
                )}
              >
                <span className={cn('rounded-lg p-1', tone)}>
                  <Icon aria-hidden className="size-4" />
                </span>
                {t(`kinds.${k}`)}
              </button>
            )
          })}
        </div>
      </fieldset>

      <Field label={t('item.title')} error={errors.title}>
        <Input
          name="title"
          required
          maxLength={120}
          defaultValue={item?.title}
          autoComplete="off"
        />
      </Field>

      <Field label={t('item.day')} error={errors.dayDate}>
        <Select name="dayDate" defaultValue={item?.dayDate ?? defaultDay}>
          {tripDays(trip.startDate, trip.endDate).map((d, i) => (
            <option key={d} value={d}>
              {t('trips.dayN', { n: i + 1 })} · {f.day(d)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('item.timeZone')} error={errors.timeZone}>
        <Select value={zone} onChange={(e) => setZone(e.target.value)}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {zoneLabel(z)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label={t('item.start')} error={errors.startsAt}>
          <Input
            type="datetime-local"
            name="start"
            required
            defaultValue={
              item ? toLocalInput(new Date(item.startsAt), item.timeZone) : `${defaultDay}T09:00`
            }
          />
        </Field>
        <Field label={t('item.end')} hint={t('common.optional')} error={errors.endsAt}>
          <Input
            type="datetime-local"
            name="end"
            defaultValue={
              item?.endsAt
                ? toLocalInput(new Date(item.endsAt), item.details.arrivalTimeZone ?? item.timeZone)
                : ''
            }
          />
        </Field>
      </div>

      {kind === 'flight' && (
        <>
          <Field label={t('item.arrivalTimeZone')} error={errors['details.arrivalTimeZone']}>
            <Select value={arrivalZone} onChange={(e) => setArrivalZone(e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {zoneLabel(z)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('item.flightNumber')} hint={t('common.optional')}>
            <Input name="flightNumber" maxLength={12} defaultValue={item?.details.flightNumber} />
          </Field>
        </>
      )}

      {kind === 'move' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('item.line')} hint={t('common.optional')}>
            <Input name="line" maxLength={20} defaultValue={item?.details.line} />
          </Field>
          <Field label={t('item.lineColor')} error={errors['details.lineColor']}>
            <Input
              type="color"
              name="lineColor"
              className="p-1"
              defaultValue={item?.details.lineColor ?? '#00a84d'}
            />
          </Field>
        </div>
      )}

      {kind === 'place' && (
        <>
          <Field label={t('item.address')} hint={t('common.optional')}>
            <Input name="address" maxLength={300} defaultValue={item?.details.address} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('item.hours')} hint={t('common.optional')}>
              <Input name="hours" maxLength={80} defaultValue={item?.details.hours} />
            </Field>
            <Field label={t('item.phone')} hint={t('common.optional')}>
              <Input type="tel" name="phone" maxLength={40} defaultValue={item?.details.phone} />
            </Field>
          </div>
          <Field label={t('item.url')} hint={t('common.optional')} error={errors['details.url']}>
            <Input type="url" name="url" defaultValue={item?.details.url} />
          </Field>
        </>
      )}

      <Field label={t('item.notes')} hint={t('common.optional')}>
        <Textarea name="notes" maxLength={2000} defaultValue={item?.notes ?? ''} />
      </Field>

      <Button type="submit" size="lg" disabled={busy}>
        {t('common.save')}
      </Button>
      {item && (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onDuplicate} disabled={busy}>
            <Copy aria-hidden className="size-4" />
            {t('common.duplicate')}
          </Button>
          <Button variant="secondary" className="text-danger" onClick={onDelete} disabled={busy}>
            <Trash2 aria-hidden className="size-4" />
            {t('common.delete')}
          </Button>
        </div>
      )}
    </form>
  )
}
