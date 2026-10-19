'use client'

import { InfoCardDto, type InfoCardKind, type TripDetailDto } from '@iplan/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BedDouble,
  Info,
  Lightbulb,
  type LucideIcon,
  Pencil,
  Plane,
  Plus,
  Siren,
  Sofa,
  Stethoscope,
  Trash2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'
import { confirmDialog } from '@/lib/confirm'

const key = (tripId: string) => ['trips', tripId, 'info'] as const
const KINDS: InfoCardKind[] = ['flight', 'hotel', 'health', 'lounge', 'emergency', 'tip', 'other']
const ICON: Record<InfoCardKind, LucideIcon> = {
  flight: Plane,
  hotel: BedDouble,
  health: Stethoscope,
  lounge: Sofa,
  emergency: Siren,
  tip: Lightbulb,
  other: Info,
}

/**
 * Phone numbers become tap-to-call links. Emergency cards also link short
 * numbers (112, 1330); elsewhere only 7+ digits, so "DM 101" stays text.
 */
function Body({ text, shortNumbers }: { text: string; shortNumbers: boolean }) {
  const minDigits = shortNumbers ? 3 : 7
  const parts = text.split(/(\+?\d[\d\s-]*\d)/g)
  return (
    <p className="text-[15px] leading-relaxed whitespace-pre-line">
      {parts.map((part, i) =>
        /^\+?\d[\d\s-]*\d$/.test(part) && part.replace(/\D/g, '').length >= minDigits ? (
          <a
            key={i}
            href={`tel:${part.replace(/[\s-]/g, '')}`}
            className="font-medium text-primary underline"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  )
}

export function InfoView({
  trip,
  initialCards,
}: {
  trip: TripDetailDto
  initialCards: InfoCardDto[]
}) {
  const t = useTranslations()
  const client = useQueryClient()
  const canEdit = trip.role !== 'viewer'
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { data: cards } = useQuery({
    queryKey: key(trip.id),
    queryFn: () => apiFetch(`/api/trips/${trip.id}/info`, { schema: z.array(InfoCardDto) }),
    initialData: initialCards,
  })
  const refresh = () => client.invalidateQueries({ queryKey: key(trip.id) })
  const save = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string | 'new'
      kind: InfoCardKind
      title: string
      body: string
    }) =>
      id === 'new'
        ? apiFetch(`/api/trips/${trip.id}/info`, { method: 'POST', body, schema: InfoCardDto })
        : apiFetch(`/api/info/${id}`, { method: 'PATCH', body, schema: InfoCardDto }),
    onSuccess: async () => {
      setEditing(null)
      setErrors({})
      await refresh()
    },
    onError: (e) => setErrors(e instanceof ApiError ? e.fields : {}),
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/info/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  })

  function onSubmit(event: FormEvent<HTMLFormElement>, id: string | 'new') {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    save.mutate({
      id,
      kind: String(form.get('kind')) as InfoCardKind,
      title: String(form.get('title') ?? ''),
      body: String(form.get('body') ?? ''),
    })
  }

  const form = (card?: InfoCardDto) => (
    <Card className="space-y-3">
      <form onSubmit={(e) => onSubmit(e, card?.id ?? 'new')} className="space-y-3">
        <Field label={t('info.kind')}>
          <Select name="kind" defaultValue={card?.kind ?? 'other'}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`info.kinds.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('info.cardTitle')} error={errors.title}>
          noLeadingSpace <Input name="title" required maxLength={120} defaultValue={card?.title} />
        </Field>
        <Field label={t('info.body')} error={errors.body}>
          <Textarea name="body" rows={5} maxLength={4000} defaultValue={card?.body} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setEditing(null)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Card>
  )

  return (
    <div className="space-y-3 px-4">
      {cards.length === 0 && editing !== 'new' && (
        <Card className="text-muted-foreground">{t('info.empty')}</Card>
      )}
      {cards.map((card) => {
        if (editing === card.id) return <div key={card.id}>{form(card)}</div>
        const Icon = ICON[card.kind]
        return (
          <Card key={card.id}>
            <div className="mb-2 flex items-center gap-2">
              <Icon aria-hidden className="size-5 text-primary" />
              <h2 className="flex-1 font-semibold">{card.title}</h2>
              {canEdit && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.edit')}
                    onClick={() => setEditing(card.id)}
                  >
                    <Pencil aria-hidden className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger"
                    aria-label={t('common.delete')}
                    onClick={async () =>
                      (await confirmDialog(t('common.confirmDelete'), { danger: true })) &&
                      remove.mutate(card.id)
                    }
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </>
              )}
            </div>
            <Body text={card.body} shortNumbers={card.kind === 'emergency'} />
          </Card>
        )
      })}
      {canEdit &&
        (editing === 'new' ? (
          form()
        ) : (
          <Button variant="secondary" size="lg" onClick={() => setEditing('new')}>
            <Plus aria-hidden className="size-5" />
            {t('info.add')}
          </Button>
        ))}
    </div>
  )
}
