'use client'

import type { TripDetailDto, TripItemDetails, TripItemDto, TripItemKind } from '@iplan/contracts'
import { fromLocalInput, isValidTimeZone, toLocalInput } from '@iplan/core'
import { Copy, Trash2 } from 'lucide-react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type FormEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DateTimeField } from '@/components/ui/date-fields'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { ITEM_KINDS, KIND_STYLE } from '@/lib/item-kinds'
import { TIME_ZONES, zoneLabel } from '@/lib/time-zones'
import { tripDays } from '@/lib/trip-dates'
import { useItemMutations } from '@/lib/trips'
import { goBack } from '@/lib/history'
import { itemsToShift, minutesMoved } from '@/lib/shift'
import { useFormat } from '@/lib/use-format'
import { ColorSwatches } from '@/components/ui/color-swatches'
import { LinePicker } from './line-picker'
import { PlaceSearch } from './place-search'
import { confirmDialog } from '@/lib/confirm'
import { useUnsavedChanges } from '@/lib/unsaved'

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim()

const DETAIL_FIELDS = [
  'address',
  'phone',
  'url',
  'hours',
  'line',
  'lineColor',
  'flightNumber',
  'from',
  'to',
  'terminal',
] as const

export function ItemForm({
  trip,
  item,
  items = [],
  defaultDay,
  defaultTimeZone,
}: {
  trip: TripDetailDto
  item?: TripItemDto
  /** The trip's items, to offer moving the ones after this item when its time changes. */
  items?: TripItemDto[]
  defaultDay: string
  defaultTimeZone: string
}) {
  const t = useTranslations()
  const f = useFormat()
  const router = useRouter()
  const mutations = useItemMutations(trip.id)
  const [kind, setKind] = useState<TripItemKind>(item?.kind ?? 'place')
  const [zone, setZone] = useState(item?.timeZone ?? defaultTimeZone)
  // Only flights have an arrival zone; for anything else the end is in the start's zone.
  const storedEndZone =
    item?.kind === 'flight' ? (item.details.arrivalTimeZone ?? item.timeZone) : item?.timeZone
  const [arrivalZone, setArrivalZone] = useState(storedEndZone ?? zone)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)
  // Warn before leaving with unsaved edits; saving or deleting clears it first.
  const { markSaved } = useUnsavedChanges(formRef)
  const [startValue, setStartValue] = useState(
    item ? toLocalInput(new Date(item.startsAt), item.timeZone) : `${defaultDay}T09:00`,
  )
  const [endValue, setEndValue] = useState(
    item?.endsAt && storedEndZone ? toLocalInput(new Date(item.endsAt), storedEndZone) : '',
  )
  /** Remounts the end picker when its text is converted to another zone. */
  const [endKey, setEndKey] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  // A place's own colour in the plan; empty = follow the ride that brought you there.
  const [spotColor, setSpotColor] = useState(
    item && item.kind !== 'move' ? (item.details.lineColor ?? '') : '',
  )
  const busy = Object.values(mutations).some((m) => m.isPending)
  const zones = [...new Set<string>([...TIME_ZONES, zone, arrivalZone, trip.homeTimeZone])].filter(
    isValidTimeZone,
  )
  const endZone = kind === 'flight' ? arrivalZone : zone

  /**
   * Switching to or from a flight moves the end into another zone (arrival vs
   * start). Keep the same moment by rewriting the end time shown in the new zone.
   */
  function changeKind(next: TripItemKind) {
    const nextEndZone = next === 'flight' ? arrivalZone : zone
    if (endValue && nextEndZone !== endZone) {
      try {
        setEndValue(toLocalInput(fromLocalInput(endValue, endZone), nextEndZone))
        setEndKey((k) => k + 1)
      } catch {
        // An incomplete time stays as typed.
      }
    }
    setKind(next)
  }
  // Going back lands on the edited item, not the top of the day.
  const backToDay = `/trips/${trip.id}?day=${item?.dayDate ?? defaultDay}${
    item ? `&focus=${item.id}` : ''
  }` as Route

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
    const managed = new Set<string>([
      ...DETAIL_FIELDS,
      'via',
      'fixed',
      'arrivalTimeZone',
      'lat',
      'lng',
    ])
    const details: TripItemDetails = Object.fromEntries(
      Object.entries(item?.details ?? {}).filter(([key]) => !managed.has(key)),
    )
    for (const key of DETAIL_FIELDS) {
      const value = text(form, key)
      if (value) details[key] = value
    }
    // A booked time (flight, appointment) never moves when earlier items run long.
    if (form.get('fixed') === 'true') details.fixed = true
    const via = form.getAll('via').map(String).filter(Boolean)
    if (kind === 'move' && via.length) details.via = via
    if (kind === 'flight' && arrivalZone !== zone) details.arrivalTimeZone = arrivalZone
    // Coordinates come with a picked place suggestion; typing an address clears them.
    const lat = Number(text(form, 'lat'))
    const lng = Number(text(form, 'lng'))
    if (text(form, 'lat') && text(form, 'lng') && Number.isFinite(lat) && Number.isFinite(lng)) {
      details.lat = lat
      details.lng = lng
    }

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
      const saved = item
        ? await mutations.update.mutateAsync({ id: item.id, ...input })
        : await mutations.create.mutateAsync(input)
      if (item) await offerShift(item, saved)
      // Back to where you were (scroll kept); a fresh visit lands on the item instead.
      markSaved()
      goBack(router, `/trips/${trip.id}?day=${input.dayDate}&focus=${saved.id}`)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields)
        setFormError(t(`errors.${error.code}`))
      } else setFormError(t('errors.INTERNAL'))
    }
  }

  /**
   * The item now ends later (or earlier): offer to move the rest of that day by
   * the same amount, stopping before the first fixed-time item.
   */
  async function offerShift(before: TripItemDto, after: TripItemDto) {
    const minutes = minutesMoved(before, after)
    if (minutes === 0) return
    const { move, stoppedAt } = itemsToShift(items, before)
    if (move.length === 0) return
    const amount = `${minutes > 0 ? '+' : '−'}${f.duration(Math.abs(minutes) * 60_000)}`
    const ok = await confirmDialog({
      title: t('item.shiftTitle'),
      message: [
        t('item.shiftBody', { amount, count: move.length }),
        stoppedAt ? t('item.shiftStops', { title: stoppedAt.title }) : '',
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: t('item.shiftYes', { count: move.length }),
      cancelLabel: t('item.shiftNo'),
    })
    if (!ok) return
    try {
      await mutations.shift.mutateAsync({ itemIds: move.map((i) => i.id), minutes })
    } catch (error) {
      // The item itself is saved; say why the others didn't move.
      setFormError(t(`errors.${error instanceof ApiError ? error.code : 'INTERNAL'}`))
      throw error
    }
  }

  async function onDuplicate() {
    if (!item) return
    await mutations.duplicate.mutateAsync(item.id)
    markSaved()
    goBack(router, backToDay)
    router.refresh()
  }

  async function onDelete() {
    if (!item || !(await confirmDialog(t('common.confirmDelete'), { danger: true }))) return
    await mutations.remove.mutateAsync(item.id)
    markSaved()
    goBack(router, backToDay)
    router.refresh()
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4 px-4" noValidate>
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
                onClick={() => changeKind(k)}
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
          noLeadingSpace
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
          <DateTimeField
            name="start"
            label={t('item.start')}
            onChange={setStartValue}
            fallbackDate={item?.dayDate ?? defaultDay}
            defaultValue={
              item ? toLocalInput(new Date(item.startsAt), item.timeZone) : `${defaultDay}T09:00`
            }
          />
        </Field>
        <Field label={t('item.end')} hint={t('common.optional')} error={errors.endsAt}>
          <DateTimeField
            key={endKey}
            name="end"
            label={t('item.end')}
            onChange={setEndValue}
            optional
            fallbackDate={item?.dayDate ?? defaultDay}
            defaultValue={endValue}
          />
        </Field>
      </div>

      <label className="flex min-h-11 items-start gap-3 rounded-2xl border px-3 py-2.5">
        <input
          type="checkbox"
          name="fixed"
          value="true"
          defaultChecked={item?.details.fixed === true}
          className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
        />
        <span>
          <span className="block text-sm font-medium">{t('item.fixed')}</span>
          <span className="block text-xs text-muted-foreground">{t('item.fixedHint')}</span>
        </span>
      </label>

      <TravelTime
        start={startValue}
        end={endValue}
        zone={zone}
        endZone={endZone}
        onDuration={(minutes) => {
          // A duration chip sets the end time from the start (in the end's zone for flights).
          try {
            const start = fromLocalInput(startValue, zone).getTime()
            setEndValue(toLocalInput(new Date(start + minutes * 60_000), endZone))
            setEndKey((k) => k + 1)
          } catch {
            // No valid start yet: nothing to add to.
          }
        }}
      />

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
          <Field label={t('item.flightNumber')}>
            <Input
              name="flightNumber"
              maxLength={12}
              placeholder="VZ850"
              autoCapitalize="characters"
              defaultValue={item?.details.flightNumber}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('item.from')}>
              <Input
                name="from"
                maxLength={40}
                placeholder="BKK"
                autoCapitalize="characters"
                defaultValue={item?.details.from}
              />
            </Field>
            <Field label={t('item.to')}>
              <Input
                name="to"
                maxLength={40}
                placeholder="ICN"
                autoCapitalize="characters"
                defaultValue={item?.details.to}
              />
            </Field>
            <Field label={t('item.terminal')} hint={t('common.optional')}>
              <Input name="terminal" maxLength={40} defaultValue={item?.details.terminal} />
            </Field>
          </div>
        </>
      )}

      {kind !== 'move' && (
        <div>
          <p className="mb-1.5 text-sm text-muted-foreground">{t('item.planColor')}</p>
          {spotColor && <input type="hidden" name="lineColor" value={spotColor} />}
          <ColorSwatches
            value={spotColor}
            onChange={setSpotColor}
            label={t('item.planColor')}
            autoLabel={t('item.planColorAuto')}
            customLabel={t('lines.moreColors')}
          />
          <p className="mt-1 text-xs text-faint">{t('item.planColorHint')}</p>
        </div>
      )}

      {kind === 'move' && (
        <LinePicker
          line={item?.details.line}
          via={item?.details.via}
          color={item?.details.lineColor}
          from={item?.kind === 'move' ? item.details.from : undefined}
          to={item?.kind === 'move' ? item.details.to : undefined}
          timeZone={zone}
        />
      )}

      {kind === 'place' && (
        <>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{t('item.address')}</p>
            <PlaceSearch
              defaultAddress={item?.details.address}
              defaultCoords={
                typeof item?.details.lat === 'number' && typeof item.details.lng === 'number'
                  ? { lat: item.details.lat, lng: item.details.lng }
                  : undefined
              }
              onPick={(place) => {
                // Fill an empty title with the place's name, like Apple Calendar.
                const title = formRef.current?.elements.namedItem('title')
                if (title instanceof HTMLInputElement && !title.value.trim()) {
                  title.value = place.name
                }
              }}
            />
          </div>
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

const DURATIONS = [15, 30, 60, 90, 120] as const

/**
 * How long it takes, worked out from the start and end times (crossing zones
 * too), plus chips that set the end for you: start + 15 min, 30 min, 1 h, ...
 */
function TravelTime({
  start,
  end,
  zone,
  endZone,
  onDuration,
}: {
  start: string
  end: string
  zone: string
  endZone: string
  onDuration: (minutes: number) => void
}) {
  const t = useTranslations('item')
  const f = useFormat()
  const [custom, setCustom] = useState(false)
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  let ms: number | null = null
  try {
    if (start && end) {
      ms = fromLocalInput(end, endZone).getTime() - fromLocalInput(start, zone).getTime()
    }
  } catch {
    ms = null
  }
  return (
    <div className="space-y-2">
      {ms !== null && (
        <p
          className={cn(
            'rounded-xl px-3 py-2 text-sm',
            ms < 0 ? 'bg-danger/10 text-danger' : 'bg-muted text-muted-foreground',
          )}
        >
          {ms < 0 ? t('endBeforeStart') : t('duration', { time: f.duration(ms) })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('setDuration')}</span>
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onDuration(m)}
            className={cn(
              'min-h-10 rounded-full border px-3 text-sm',
              ms === m * 60_000 ? 'chip-on' : 'bg-card',
            )}
          >
            {f.duration(m * 60_000)}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={custom}
          onClick={() => setCustom((c) => !c)}
          className={cn(
            'min-h-10 rounded-full border border-dashed px-3 text-sm',
            custom ? 'chip-on border-solid' : 'bg-card',
          )}
        >
          {t('customDuration')}
        </button>
      </div>
      {custom && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border p-3">
          {(
            [
              ['durationHours', hours, setHours, 99],
              ['durationMinutes', minutes, setMinutes, 59],
            ] as const
          ).map(([key, value, set, max]) => (
            <label key={key} className="grid gap-1 text-sm text-muted-foreground">
              {t(key)}
              <Input
                inputMode="numeric"
                className="w-20 text-center tabular-nums"
                value={value}
                maxLength={2}
                placeholder="0"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '')
                  set(digits === '' ? '' : String(Math.min(max, Number(digits))))
                }}
              />
            </label>
          ))}
          <Button
            variant="secondary"
            disabled={!Number(hours) && !Number(minutes)}
            onClick={() => {
              onDuration(Number(hours || 0) * 60 + Number(minutes || 0))
              setCustom(false)
            }}
          >
            {t('applyDuration')}
          </Button>
        </div>
      )}
    </div>
  )
}
