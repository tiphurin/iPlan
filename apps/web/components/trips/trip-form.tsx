'use client'

import type { TripColor, TripDetailDto } from '@iplan/contracts'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-fields'
import { Field, Input, Select } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { TripColorPicker } from '@/components/trips/trip-color-picker'
import { CURRENCIES, TIME_ZONES, zoneLabel } from '@/lib/time-zones'
import { coverColor } from '@/lib/trip-color'
import { useCreateTrip, useDeleteTrip, useUpdateTrip } from '@/lib/trips'

export function TripForm({
  trip,
  currencyLocked = false,
  suggestedColor,
}: {
  trip?: TripDetailDto
  /** Preselected cover colour for a new trip. */
  suggestedColor?: TripColor
  /** The trip has expenses, so its currency can't change (the API refuses it too). */
  currencyLocked?: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const create = useCreateTrip()
  const update = useUpdateTrip(trip?.id ?? '')
  const remove = useDeleteTrip(trip?.id ?? '')
  const initialColor = trip ? coverColor(trip) : (suggestedColor ?? null)
  const [color, setColor] = useState<string | null>(initialColor)
  const [name, setName] = useState(trip?.name ?? '')
  const [destination, setDestination] = useState(trip?.destination ?? '')
  const [startDate, setStartDate] = useState(trip?.startDate ?? '')
  const [endDate, setEndDate] = useState(trip?.endDate ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const currencyNote = currencyLocked
    ? t('trips.currencyLocked')
    : trip && (Object.keys(trip.fxRates).length > 0 || trip.dailyBudgetMinor !== null)
      ? t('trips.currencyResets')
      : null
  const busy = create.isPending || update.isPending || remove.isPending

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input = {
      name: String(form.get('name') ?? ''),
      destination: String(form.get('destination') ?? '') || null,
      startDate: String(form.get('startDate') ?? ''),
      endDate: String(form.get('endDate') ?? ''),
      homeTimeZone: String(form.get('homeTimeZone') ?? 'Asia/Bangkok'),
      // A locked (disabled) picker isn't in the form data; keep the stored currency.
      baseCurrency:
        trip && currencyLocked ? trip.baseCurrency : String(form.get('baseCurrency') ?? 'THB'),
      // Only send a colour the user picked; an untouched edit keeps the stored one.
      ...(color && (!trip || color !== initialColor) ? { color: color as TripColor } : {}),
    }
    setErrors({})
    setFormError(null)
    try {
      const saved = trip ? await update.mutateAsync(input) : await create.mutateAsync(input)
      router.push(`/trips/${saved.id}` as Route)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields)
        setFormError(t(`errors.${error.code}`))
      } else setFormError(t('errors.INTERNAL'))
    }
  }

  async function onDelete() {
    if (!trip || !window.confirm(t('trips.confirmDeleteTrip'))) return
    await remove.mutateAsync()
    router.replace('/trips')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 px-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <Field label={t('trips.name')} error={errors.name}>
        <Input
          noLeadingSpace
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </Field>
      <Field label={t('trips.destination')} hint={t('common.optional')} error={errors.destination}>
        <Input
          noLeadingSpace
          name="destination"
          maxLength={120}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
      </Field>
      <TripColorPicker
        value={color ?? 'var(--muted)'}
        onChange={setColor}
        name={name}
        destination={destination}
      />
      {errors.color && <p className="text-sm text-danger">{errors.color}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('trips.startDate')} error={errors.startDate}>
          <DateField
            name="startDate"
            label={t('trips.startDate')}
            value={startDate}
            onChange={(d) => {
              setStartDate(d)
              // Keep the end on or after the start.
              if (!endDate || endDate < d) setEndDate(d)
            }}
          />
        </Field>
        <Field label={t('trips.endDate')} error={errors.endDate}>
          <DateField
            name="endDate"
            label={t('trips.endDate')}
            value={endDate}
            onChange={setEndDate}
            min={startDate || undefined}
          />
        </Field>
      </div>
      <Field label={t('trips.homeTimeZone')} error={errors.homeTimeZone}>
        <Select name="homeTimeZone" defaultValue={trip?.homeTimeZone ?? 'Asia/Bangkok'}>
          {TIME_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zoneLabel(zone)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('trips.currency')} error={errors.baseCurrency}>
        <Select
          name="baseCurrency"
          defaultValue={trip?.baseCurrency ?? 'THB'}
          disabled={currencyLocked}
        >
          {CURRENCIES.map((code) => (
            <option key={code}>{code}</option>
          ))}
        </Select>
        {currencyNote && (
          <span className="block text-xs text-muted-foreground">{currencyNote}</span>
        )}
      </Field>
      <Button type="submit" size="lg" disabled={busy}>
        {trip ? t('common.save') : t('trips.create')}
      </Button>
      {trip?.role === 'owner' && (
        <Button
          variant="ghost"
          size="lg"
          className="text-danger"
          onClick={onDelete}
          disabled={busy}
        >
          {t('trips.deleteTrip')}
        </Button>
      )}
    </form>
  )
}
