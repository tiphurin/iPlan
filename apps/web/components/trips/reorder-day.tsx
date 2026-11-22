'use client'

import type { TripItemDto } from '@iplan/contracts'
import { dayBlocks, replanDay } from '@iplan/core'
import { ArrowDown, ArrowUp, GripVertical, Lock, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { retimePayload, toPlanItems } from '@/lib/reorder'
import { useItemMutations } from '@/lib/trips'
import { useFormat } from '@/lib/use-format'

type Change = ReturnType<typeof retimePayload>['undo']

/**
 * Reorder one plan day. A place moves together with the travel rows above it
 * (the way there); times are recalculated live and saved in one go. Wake and
 * sleep stay put, travel after the last place stays at the end, fixed-time
 * places keep their time.
 */
export function ReorderDay({
  tripId,
  items,
  onDone,
}: {
  tripId: string
  /** The day's items, in plan order. */
  items: TripItemDto[]
  /** Called after saving (with what undoes it) or on cancel (null). */
  onDone: (undo: Change | null) => void
}) {
  const t = useTranslations('reorder')
  const tErr = useTranslations('errors')
  const f = useFormat()
  const { retime } = useItemMutations(tripId)
  const plan = useMemo(() => dayBlocks(toPlanItems(items)), [items])
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const [order, setOrder] = useState(() => plan.blocks.map((b) => b.id))
  const [error, setError] = useState<string | null>(null)
  const result = useMemo(() => replanDay(toPlanItems(items), order), [items, order])
  const newTimes = new Map(result.changes.map((c) => [c.id, c]))
  const flagged = new Set(result.routeChanged)
  const blocks = new Map(plan.blocks.map((b) => [b.id, b]))

  const time = (id: string) => {
    const item = byId.get(id) as TripItemDto
    const next = newTimes.get(id)
    const startsAt = next ? new Date(next.startsAt).toISOString() : item.startsAt
    return {
      now: f.time(startsAt, item.timeZone),
      was: next ? f.time(item.startsAt, item.timeZone) : null,
    }
  }

  function move(id: string, to: number) {
    setOrder((current) => {
      const from = current.indexOf(id)
      if (from === -1 || to < 0 || to >= current.length || to === from) return current
      const next = [...current]
      next.splice(from, 1)
      next.splice(to, 0, id)
      return next
    })
    setError(null)
  }

  // Drag by the grip: the block follows the finger; dropping places it before the block under it.
  const listRef = useRef<HTMLOListElement>(null)
  const [drag, setDrag] = useState<{ id: string; y0: number; dy: number; target: number } | null>(
    null,
  )
  function onGripDown(e: ReactPointerEvent<HTMLButtonElement>, id: string) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ id, y0: e.clientY, dy: 0, target: order.indexOf(id) })
  }
  function onGripMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag || !listRef.current) return
    const rows = [...listRef.current.querySelectorAll<HTMLElement>('[data-block]')]
    const others = rows.filter((r) => r.dataset.block !== drag.id)
    let target = others.findIndex((r) => {
      const box = r.getBoundingClientRect()
      return e.clientY < box.top + box.height / 2
    })
    if (target === -1) target = others.length
    setDrag({ ...drag, dy: e.clientY - drag.y0, target })
  }
  function onGripUp() {
    if (!drag) return
    move(drag.id, drag.target)
    setDrag(null)
  }

  async function save() {
    const { save: changes, undo } = retimePayload(items, result)
    if (changes.length === 0) return onDone(null)
    try {
      await retime.mutateAsync({ changes })
      onDone(undo)
    } catch (e) {
      setError(tErr(e instanceof ApiError ? e.code : 'INTERNAL'))
    }
  }

  const changedPlaces = order.filter((id) => newTimes.has(id))
  const conflictTitle = result.conflict ? byId.get(result.conflict.blockId)?.title : null

  const fixedRow = (item: TripItemDto) => (
    <li key={item.id} className="flex items-center gap-3 px-2 py-2 text-sm text-muted-foreground">
      <span className="num w-12 text-right">{f.time(item.startsAt, item.timeZone)}</span>
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
    </li>
  )

  return (
    <div className="space-y-3">
      <p
        role="status"
        className={cn(
          'rounded-xl px-3 py-2 text-sm',
          result.conflict
            ? 'bg-danger/10 text-danger'
            : flagged.size > 0
              ? 'bg-warning/10 text-warning'
              : 'bg-primary/10 text-primary',
        )}
      >
        {result.conflict
          ? t('conflict', {
              title: conflictTitle ?? '',
              time: time(result.conflict.blockId).now,
              amount: f.duration(result.conflict.minutes * 60_000),
            })
          : flagged.size > 0
            ? t('checkRoutes', { count: flagged.size })
            : t('hint')}
      </p>

      {changedPlaces.length > 0 && (
        <div className="rounded-xl border bg-card px-3 py-2 text-sm">
          <p className="mb-1 font-semibold">{t('changes')}</p>
          <ul className="space-y-0.5">
            {changedPlaces.map((id) => {
              const { now, was } = time(id)
              return (
                <li key={id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{byId.get(id)?.title}</span>
                  <span className="num shrink-0">
                    <s className="text-faint">{was}</s> → <b>{now}</b>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <ol ref={listRef} className="space-y-2" aria-label={t('listLabel')}>
        {plan.anchors
          .filter((a) => a.kind === 'wake')
          .map((a) => fixedRow(byId.get(a.id) as TripItemDto))}
        {order.map((id, index) => {
          const block = blocks.get(id)
          if (!block) return null
          const place = byId.get(id) as TripItemDto
          const dragging = drag?.id === id
          const { now, was } = time(id)
          return (
            <li
              key={id}
              data-block={id}
              className={cn(
                'relative rounded-2xl bg-muted/60 p-1.5',
                dragging && 'z-10 shadow-lg ring-2 ring-primary',
                drag &&
                  !dragging &&
                  drag.target === order.filter((x) => x !== drag.id).indexOf(id) &&
                  'before:absolute before:-top-1.5 before:right-3 before:left-3 before:h-1 before:rounded before:bg-primary',
              )}
              style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
            >
              <div className="flex gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  {block.items
                    .filter((x) => x.id !== id)
                    .map((leg) => {
                      const item = byId.get(leg.id) as TripItemDto
                      const legTime = time(leg.id)
                      return (
                        <div
                          key={leg.id}
                          className="flex items-start gap-2 px-1 py-1 text-[13px] text-muted-foreground"
                        >
                          <span className="num w-11 shrink-0 text-right">{legTime.now}</span>
                          <span className="min-w-0 flex-1">
                            <span className="text-foreground">{item.title}</span>
                            {flagged.has(leg.id) && (
                              <span className="ml-1 inline-flex rounded-full bg-warning/15 px-2 text-xs font-semibold text-warning">
                                {t('routeTag')}
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  <div
                    className={cn(
                      'flex gap-2 rounded-xl border bg-card px-2 py-2',
                      was && 'border-warning/60',
                      block.fixed && 'border-l1/60',
                    )}
                  >
                    <span className="num w-11 shrink-0 text-right text-[15px] leading-tight">
                      {now}
                      {was && <s className="block text-xs text-warning">{was}</s>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{place.title}</span>
                      <span className="flex flex-wrap gap-1 text-xs">
                        {block.fixed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 text-muted-foreground">
                            <Lock aria-hidden className="size-3" />
                            {t('fixed')}
                          </span>
                        )}
                        {was && (
                          <span className="rounded-full bg-warning/15 px-2 font-semibold text-warning">
                            {t('was', { time: was })}
                          </span>
                        )}
                        {flagged.has(id) && (
                          <span className="rounded-full bg-warning/15 px-2 font-semibold text-warning">
                            {t('routeTag')}
                          </span>
                        )}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    aria-label={t('drag', { title: place.title })}
                    onPointerDown={(e) => onGripDown(e, id)}
                    onPointerMove={onGripMove}
                    onPointerUp={onGripUp}
                    onPointerCancel={() => setDrag(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        move(id, index - 1)
                      }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        move(id, index + 1)
                      }
                    }}
                    className="flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-xl border bg-card text-muted-foreground"
                  >
                    <GripVertical aria-hidden className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('up', { title: place.title })}
                    disabled={index === 0}
                    onClick={() => move(id, index - 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border bg-card disabled:opacity-30"
                  >
                    <ArrowUp aria-hidden className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('down', { title: place.title })}
                    disabled={index === order.length - 1}
                    onClick={() => move(id, index + 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border bg-card disabled:opacity-30"
                  >
                    <ArrowDown aria-hidden className="size-5" />
                  </button>
                </div>
              </div>
            </li>
          )
        })}
        {plan.tail.map((x) => (
          <li
            key={x.id}
            className="flex items-center gap-3 px-2 py-2 text-sm text-muted-foreground"
          >
            <span className="num w-12 text-right">{time(x.id).now}</span>
            <span className="min-w-0 flex-1 truncate">
              {byId.get(x.id)?.title}
              {flagged.has(x.id) && (
                <span className="ml-1 inline-flex rounded-full bg-warning/15 px-2 text-xs font-semibold text-warning">
                  {t('routeTag')}
                </span>
              )}
            </span>
          </li>
        ))}
        {plan.anchors
          .filter((a) => a.kind === 'sleep')
          .map((a) => fixedRow(byId.get(a.id) as TripItemDto))}
      </ol>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-20 grid grid-cols-[1fr_2fr] gap-2 rounded-2xl border bg-card p-2 shadow-lg md:bottom-4">
        <Button variant="secondary" onClick={() => onDone(null)} disabled={retime.isPending}>
          {t('cancel')}
        </Button>
        <Button onClick={save} disabled={Boolean(result.conflict) || retime.isPending}>
          {result.conflict
            ? t('cantSave')
            : changedPlaces.length + flagged.size > 0
              ? t('save', { count: new Set([...newTimes.keys(), ...flagged]).size })
              : t('saveNothing')}
        </Button>
      </div>
    </div>
  )
}
