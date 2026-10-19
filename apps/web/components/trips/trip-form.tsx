'use client'

import type { TripDetailDto } from '@iplan/contracts'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { CURRENCIES, TIME_ZONES, zoneLabel } from '@/lib/time-zones'
import { useCreateTrip, useDeleteTrip, useUpdateTrip } from '@/lib/trips'

export function TripForm({ trip }: { trip?: TripDetailDto }) {
  const t = useTranslations()
  const router = useRouter()
  const create = useCreateTrip()
  const update = useUpdateTrip(trip?.id ?? '')
  const remove = useDeleteTrip(trip?.id ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
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
      baseCurrency: String(form.get('baseCurrency') ?? 'THB'),
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
        <Input name="name" required maxLength={80} defaultValue={trip?.name} autoComplete="off" />
      </Field>
      <Field label={t('trips.destination')} hint={t('common.optional')} error={errors.destination}>
        <Input name="destination" maxLength={120} defaultValue={trip?.destination ?? ''} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('trips.startDate')} error={errors.startDate}>
          <Input type="date" name="startDate" required defaultValue={trip?.startDate} />
        </Field>
        <Field label={t('trips.endDate')} error={errors.endDate}>
          <Input type="date" name="endDate" required defaultValue={trip?.endDate} />
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
        <Select name="baseCurrency" defaultValue={trip?.baseCurrency ?? 'THB'}>
          {CURRENCIES.map((code) => (
            <option key={code}>{code}</option>
          ))}
        </Select>
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
