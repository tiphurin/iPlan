'use client'

import { useUnsavedChanges } from '@/lib/unsaved'
import { confirmDialog } from '@/lib/confirm'
import { type TripColor, TripDetailDto } from '@iplan/contracts'
import { useQueryClient } from '@tanstack/react-query'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-fields'
import { Field, Input, Select } from '@/components/ui/field'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'
import { prepareCover } from '@/lib/image'
import { TripColorPicker } from '@/components/trips/trip-color-picker'
import { CURRENCIES, TIME_ZONES, zoneLabel } from '@/lib/time-zones'
import { coverColor } from '@/lib/trip-color'
import {
  removeTripCover,
  tripKeys,
  uploadTripCover,
  useCreateTrip,
  useDeleteTrip,
  useUpdateTrip,
} from '@/lib/trips'

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
  const formRef = useRef<HTMLFormElement>(null)
  // Warn before leaving with unsaved edits; saving or deleting clears it first.
  const { markSaved } = useUnsavedChanges(formRef)
  const client = useQueryClient()
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
  // Cover photo: picked (resized, not yet uploaded) or the stored one unless removed.
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  // Set once a new trip exists, so retrying a failed cover upload doesn't create it twice.
  const createdId = useRef<string | null>(null)
  const preview = photo?.url ?? (photoRemoved ? null : (trip?.coverUrl ?? null))
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo])
  const currencyNote = currencyLocked
    ? t('trips.currencyLocked')
    : trip && (Object.keys(trip.fxRates).length > 0 || trip.dailyBudgetMinor !== null)
      ? t('trips.currencyResets')
      : null
  const [saving, setSaving] = useState(false)
  const busy = saving || photoBusy || create.isPending || update.isPending || remove.isPending

  async function pickPhoto(file: File) {
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const blob = await prepareCover(file)
      setPhoto({ blob, url: URL.createObjectURL(blob) })
      setPhotoRemoved(false)
    } catch {
      setPhotoError(t('trips.coverPhotoUnreadable'))
    } finally {
      setPhotoBusy(false)
    }
  }

  function dropPhoto() {
    setPhoto(null)
    setPhotoRemoved(true)
    setPhotoError(null)
  }

  /** Uploads or removes the cover after the trip itself is saved. */
  async function saveCover(tripId: string) {
    if (photo) await uploadTripCover(tripId, photo.blob)
    else if (photoRemoved && trip?.coverUrl) await removeTripCover(tripId)
    else return
    await client.invalidateQueries({ queryKey: tripKeys.all })
  }

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
    setPhotoError(null)
    setSaving(true)
    let savedId: string | null = null
    try {
      const saved = trip
        ? await update.mutateAsync(input)
        : createdId.current
          ? await apiFetch(`/api/trips/${createdId.current}`, {
              method: 'PATCH',
              body: input,
              schema: TripDetailDto,
            })
          : await create.mutateAsync(input)
      savedId = saved.id
      if (!trip) createdId.current = saved.id
      await saveCover(saved.id)
      markSaved()
      router.push(`/trips/${saved.id}` as Route)
      router.refresh()
    } catch (error) {
      if (savedId) setPhotoError(t('trips.coverPhotoFailed'))
      if (error instanceof ApiError) {
        setErrors(error.fields)
        setFormError(t(`errors.${error.code}`))
      } else setFormError(t('errors.INTERNAL'))
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!trip || !(await confirmDialog(t('trips.confirmDeleteTrip'), { danger: true }))) return
    await remove.mutateAsync()
    markSaved()
    router.replace('/trips')
    router.refresh()
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4 px-4" noValidate>
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
        photo={preview}
        onPhoto={pickPhoto}
        onRemovePhoto={dropPhoto}
        photoBusy={photoBusy}
        photoError={photoError ?? errors.file}
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
