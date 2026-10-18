'use client'

import { CHECKLIST_GROUPS, ChecklistItemDto, type TripDetailDto } from '@iplan/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/cn'

const key = (tripId: string) => ['trips', tripId, 'checklist'] as const

export function ChecklistView({
  trip,
  initialItems,
  meId,
}: {
  trip: TripDetailDto
  initialItems: ChecklistItemDto[]
  meId: string
}) {
  const t = useTranslations('checklist')
  const client = useQueryClient()
  const canEdit = trip.role !== 'viewer'
  const [editing, setEditing] = useState(false)
  const { data: items } = useQuery({
    queryKey: key(trip.id),
    queryFn: () =>
      apiFetch(`/api/trips/${trip.id}/checklist`, { schema: z.array(ChecklistItemDto) }),
    initialData: initialItems,
  })
  const replace = (item: ChecklistItemDto) =>
    client.setQueryData<ChecklistItemDto[]>(key(trip.id), (list) =>
      list?.map((existing) => (existing.id === item.id ? item : existing)),
    )
  const refresh = () => client.invalidateQueries({ queryKey: key(trip.id) })

  const toggle = useMutation({
    mutationFn: ({ id, ticked }: { id: string; ticked: boolean }) =>
      apiFetch(`/api/checklist/${id}/tick`, {
        method: ticked ? 'POST' : 'DELETE',
        schema: ChecklistItemDto,
      }),
    // Flip immediately; the server answer replaces the guess.
    onMutate: ({ id, ticked }) =>
      client.setQueryData<ChecklistItemDto[]>(key(trip.id), (list) =>
        list?.map((item) =>
          item.id !== id
            ? item
            : {
                ...item,
                ticks: ticked
                  ? [...item.ticks, { userId: meId, name: '…', tickedAt: new Date().toISOString() }]
                  : item.ticks.filter((tick) => tick.userId !== meId),
              },
        ),
      ),
    onSuccess: replace,
    onError: refresh,
  })
  const add = useMutation({
    mutationFn: (input: { groupKey: string; title: string }) =>
      apiFetch(`/api/trips/${trip.id}/checklist`, {
        method: 'POST',
        body: input,
        schema: ChecklistItemDto,
      }),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/checklist/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  })

  const groups = [
    ...new Set<string>([
      ...CHECKLIST_GROUPS.filter((g) => canEdit || items.some((i) => i.groupKey === g)),
      ...items.map((i) => i.groupKey),
    ]),
  ]
  const done = items.filter((i) => i.ticks.length > 0).length
  const groupLabel = (g: string) => (t.has(`groups.${g}`) ? t(`groups.${g}`) : g)

  function onAdd(event: FormEvent<HTMLFormElement>, groupKey: string) {
    event.preventDefault()
    const form = event.currentTarget
    const title = String(new FormData(form).get('title') ?? '').trim()
    if (!title) return
    add.mutate({ groupKey, title }, { onSuccess: () => form.reset() })
  }

  return (
    <div className="space-y-5 px-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="mb-1.5 text-sm text-muted-foreground">
            {t('progress', { done, total: items.length })}
          </p>
          <Progress value={items.length ? done / items.length : 0} />
        </div>
        {canEdit && (
          <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
            {editing ? t('done') : t('editMode')}
          </Button>
        )}
      </div>

      {items.length === 0 && !canEdit && <p className="text-muted-foreground">{t('empty')}</p>}

      {groups.map((group) => {
        const list = items.filter((i) => i.groupKey === group)
        if (list.length === 0 && !editing) return null
        return (
          <section key={group}>
            <h2 className="flex items-baseline justify-between px-1 pb-2 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
              {groupLabel(group)}
              <span className="font-normal normal-case">
                {list.filter((i) => i.ticks.length > 0).length}/{list.length}
              </span>
            </h2>
            <ul className="divide-y rounded-2xl border bg-card">
              {list.map((item) => {
                const mine = item.ticks.some((tick) => tick.userId === meId)
                const doneItem = item.ticks.length > 0
                return (
                  <li key={item.id} className="flex items-center gap-3 pr-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={mine}
                      onClick={() => toggle.mutate({ id: item.id, ticked: !mine })}
                      className="flex min-h-12 flex-1 items-center gap-3 py-2 pl-4 text-left"
                    >
                      <span
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                          mine
                            ? 'border-success bg-success text-white'
                            : doneItem
                              ? 'border-success'
                              : 'border-border',
                        )}
                      >
                        {(mine || doneItem) && (
                          <Check aria-hidden className={cn('size-4', !mine && 'text-success')} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn('block', doneItem && 'text-muted-foreground line-through')}
                        >
                          {item.title}
                        </span>
                        {doneItem && (
                          <span className="block text-xs text-success">
                            {t('tickedBy', {
                              names: item.ticks.map((tick) => tick.name).join(', '),
                            })}
                          </span>
                        )}
                      </span>
                    </button>
                    {editing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-danger"
                        aria-label={item.title}
                        onClick={() => remove.mutate(item.id)}
                      >
                        <Trash2 aria-hidden className="size-5" />
                      </Button>
                    )}
                  </li>
                )
              })}
              {editing && (
                <li className="p-2">
                  <form onSubmit={(e) => onAdd(e, group)} className="flex gap-2">
                    <Input
                      name="title"
                      maxLength={200}
                      placeholder={t('addPlaceholder', { group: groupLabel(group) })}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      aria-label={t('add')}
                      disabled={add.isPending}
                    >
                      <Plus aria-hidden className="size-5" />
                    </Button>
                  </form>
                </li>
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
