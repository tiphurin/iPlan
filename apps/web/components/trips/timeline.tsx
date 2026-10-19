'use client'

import type { TripItemDto } from '@iplan/contracts'
import { parseMoney } from '@iplan/core'
import { formatMoney } from '@iplan/i18n'
import { Check, MapPin, Phone } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { KIND_STYLE } from '@/lib/item-kinds'
import { zoneCity } from '@/lib/time-zones'
import { useFormat } from '@/lib/use-format'

export type RowStatus = 'done' | 'now' | 'upcoming' | null

/** Small connectors (walks, short rides, wake/sleep) get a compact row instead of a card. */
const MINOR = new Set(['move', 'wake', 'sleep'])

/**
 * The day's plan as a subway line: time on the left, a coloured rail with a
 * station node per item, and a card (places, flights) or a compact row (moves).
 */
export function Timeline({
  items,
  tripId,
  homeTimeZone,
  color,
  meId,
  statusOf,
}: {
  items: TripItemDto[]
  tripId: string
  homeTimeZone: string
  /** The day's colour (CSS). */
  color: string
  meId?: string
  statusOf?: (id: string) => RowStatus
}) {
  return (
    <ol>
      {items.map((item, i) => (
        <TimelineRow
          key={item.id}
          item={item}
          tripId={tripId}
          homeTimeZone={homeTimeZone}
          color={color}
          meId={meId}
          status={statusOf?.(item.id) ?? null}
          last={i === items.length - 1}
        />
      ))}
    </ol>
  )
}

function TimelineRow({
  item,
  tripId,
  homeTimeZone,
  color,
  meId,
  status,
  last,
}: {
  item: TripItemDto
  tripId: string
  homeTimeZone: string
  color: string
  meId: string | undefined
  status: RowStatus
  last: boolean
}) {
  const t = useTranslations()
  const f = useFormat()
  const { icon: Icon } = KIND_STYLE[item.kind]
  const minor = MINOR.has(item.kind)
  const walk = item.kind === 'move' && (item.details.line === 'W' || !item.details.line)
  const railColor = item.details.lineColor ?? (item.kind === 'move' ? 'var(--lw)' : color)
  const mine = meId ? item.checkIns.find((c) => c.userId === meId) : undefined
  const done = status === 'done' || Boolean(mine)
  const arrivalZone = item.details.arrivalTimeZone ?? item.timeZone
  const href = `/trips/${tripId}/items/${item.id}` as Route
  const budget = item.details.budget

  return (
    <li
      className="grid grid-cols-[50px_26px_1fr] gap-x-2"
      style={{ '--node': color } as CSSProperties}
    >
      <div className={cn('pt-3 text-right leading-tight', minor && 'pt-2')}>
        <p className={cn('num text-[15px]', minor && 'text-[13px] text-muted-foreground')}>
          {f.time(item.startsAt, item.timeZone)}
        </p>
        {item.timeZone !== homeTimeZone && (
          <p className="text-[10px] text-faint">{zoneCity(item.timeZone)}</p>
        )}
      </div>

      <div className="relative" aria-hidden>
        {!last && (
          <span
            className={cn(
              'absolute top-0 bottom-0 left-1/2',
              walk ? 'w-0 border-l-[3px] border-dotted' : '-ml-[3px] w-1.5',
            )}
            style={
              walk ? { borderColor: 'var(--lw)', marginLeft: -1.5 } : { backgroundColor: railColor }
            }
          />
        )}
        <span
          className={cn(
            'absolute left-1/2 rounded-full border-solid bg-card',
            minor
              ? 'top-[15px] -ml-[7px] size-3.5 border-[3px]'
              : 'top-[13px] -ml-[11px] size-[22px] border-[5px]',
            status === 'now' &&
              'animate-[pulse-ring_1.8s_ease-in-out_infinite] shadow-[0_0_0_6px_color-mix(in_srgb,var(--node)_28%,transparent)]',
          )}
          style={{
            borderColor: minor ? railColor : color,
            ...(done && { backgroundColor: minor ? railColor : color }),
          }}
        />
      </div>

      <div className={cn('min-w-0', minor ? 'pb-1' : 'pb-2')}>
        {minor ? (
          <Link
            href={href}
            className="flex min-h-11 items-start gap-2 py-2 text-sm text-muted-foreground active:opacity-70"
          >
            {item.details.line && item.details.line !== 'W' ? (
              <span
                className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 font-display text-[13px] font-bold text-white"
                style={{ backgroundColor: railColor }}
              >
                {item.details.line}
              </span>
            ) : (
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="min-w-0">
              <span className="text-foreground">{item.title}</span>
              {item.notes && <span className="block text-xs text-faint">{item.notes}</span>}
            </span>
          </Link>
        ) : (
          <Link
            href={href}
            className={cn(
              'my-1.5 block overflow-hidden rounded-2xl border bg-card active:opacity-80',
              item.kind === 'task' && 'border-dashed',
              status === 'now' && 'border-2',
              status === 'done' && !mine && 'opacity-70',
            )}
            style={status === 'now' ? { borderColor: color } : undefined}
          >
            <div className="px-3.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-[17px] leading-snug font-semibold">{item.title}</p>
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
              </div>
              {(item.endsAt || item.details.flightNumber) && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {item.endsAt &&
                    `${f.time(item.startsAt, item.timeZone)} – ${f.time(item.endsAt, arrivalZone)}`}
                  {item.details.arrivalTimeZone &&
                    item.details.arrivalTimeZone !== item.timeZone &&
                    ` (${zoneCity(item.details.arrivalTimeZone)})`}
                  {item.details.flightNumber && ` · ${item.details.flightNumber}`}
                </p>
              )}
              {item.notes && <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>}
              {(item.details.address || item.details.phone || item.details.hours) && (
                <div className="mt-2 grid gap-0.5 text-[13px] text-muted-foreground">
                  {item.details.address && (
                    <span className="flex gap-1.5">
                      <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      {item.details.address}
                    </span>
                  )}
                  {item.details.phone && (
                    <span className="flex gap-1.5">
                      <Phone aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      {item.details.phone}
                    </span>
                  )}
                  {item.details.hours && <span>{item.details.hours}</span>}
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {item.details.fixed === true && <Tag tone="fix">{t('timeline.fixed')}</Tag>}
                {item.details.verify === true && <Tag tone="ver">{t('timeline.verify')}</Tag>}
                {item.details.optional === true && <Tag tone="opt">{t('timeline.optional')}</Tag>}
                {mine && (
                  <Tag tone="ok">
                    <Check aria-hidden className="mr-0.5 inline size-3" />
                    {t('item.checkedIn', { time: f.time(mine.checkedInAt, item.timeZone) })}
                  </Tag>
                )}
              </div>
              {budget && (
                <p className="mt-2 flex justify-between border-t pt-2 text-[13px]">
                  <span className="text-muted-foreground">{t('timeline.budget')}</span>
                  <span className="num">{budgetText(budget)}</span>
                </p>
              )}
            </div>
          </Link>
        )}
      </div>
    </li>
  )
}

function Tag({ tone, children }: { tone: 'fix' | 'ver' | 'opt' | 'ok'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'mt-1.5 inline-flex items-center rounded-full border px-2 py-px text-xs',
        tone === 'fix' && 'border-[#ef7c1c] bg-[#ef7c1c] text-white',
        tone === 'ver' && 'border-warning text-warning',
        tone === 'opt' && 'border-dashed text-muted-foreground',
        tone === 'ok' && 'border-success text-success',
      )}
    >
      {children}
    </span>
  )
}

function budgetText(budget: { amount: string; currency: string }): string {
  try {
    return formatMoney(parseMoney(budget.amount, budget.currency))
  } catch {
    return `${budget.amount} ${budget.currency}`
  }
}
