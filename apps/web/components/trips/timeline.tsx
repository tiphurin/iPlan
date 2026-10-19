'use client'

import type { TripItemDto } from '@iplan/contracts'
import { convertMoney, money, parseMoney } from '@iplan/core'
import { formatMoney } from '@iplan/i18n'
import { Check, MapPin, Phone } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { type CSSProperties, type ReactNode, useEffect } from 'react'
import { cn } from '@/lib/cn'
import { lineBadge, modeEmoji, presetOf } from '@/lib/lines'
import { routeColors } from '@/lib/route-colors'
import { useTripDisplay } from '@/lib/trip-display'
import { KIND_STYLE } from '@/lib/item-kinds'
import { zoneCity, zoneShort } from '@/lib/time-zones'
import { useFormat } from '@/lib/use-format'

export type RowStatus = 'done' | 'now' | 'upcoming' | null

/** Small connectors (walks, short rides, wake/sleep) get a compact row instead of a card. */
const MINOR = new Set(['move', 'wake', 'sleep'])

/**
 * The day's plan as a subway line: time on the left, a coloured rail with a
 * station node per item, and a card (places, flights) or a compact row (moves).
 */
export interface SpentInfo {
  /** Base-currency minor units spent per plan item (omit to show budgets only). */
  byItem?: Map<string, bigint>
  currency: string
  /** Base units per 1 foreign unit, e.g. { KRW: "0.023" }. */
  rates: Record<string, string>
}

export function Timeline({
  items,
  tripId,
  homeTimeZone,
  color,
  meId,
  statusOf,
  spent,
  focusId,
  onOpen,
}: {
  items: TripItemDto[]
  tripId: string
  homeTimeZone: string
  /** The day's colour (CSS). */
  color: string
  meId?: string
  statusOf?: (id: string) => RowStatus
  spent?: SpentInfo
  /** Item to scroll to and flash, e.g. the one just edited. */
  focusId?: string | null
  /** Open details in place (a sheet) instead of navigating to the item page. */
  onOpen?: (item: TripItemDto) => void
}) {
  useEffect(() => {
    if (!focusId) return
    document
      .getElementById(`item-${focusId}`)
      ?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  }, [focusId])
  // A place takes the colour of the ride that brought you there (Line 4 → Myeongdong in
  // Line 4 blue) until the next ride, unless it has its own colour; else the day colour.
  const rowColors = routeColors(items, color)
  return (
    <ol>
      {items.map((item, i) => (
        <TimelineRow
          key={item.id}
          item={item}
          tripId={tripId}
          homeTimeZone={homeTimeZone}
          color={rowColors[i] ?? color}
          meId={meId}
          status={statusOf?.(item.id) ?? null}
          last={i === items.length - 1}
          spent={spent}
          focused={item.id === focusId}
          onOpen={onOpen}
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
  spent,
  focused,
  onOpen,
}: {
  item: TripItemDto
  tripId: string
  homeTimeZone: string
  color: string
  meId: string | undefined
  status: RowStatus
  last: boolean
  spent: SpentInfo | undefined
  focused: boolean
  onOpen: ((item: TripItemDto) => void) | undefined
}) {
  const t = useTranslations()
  const f = useFormat()
  const { icon: Icon } = KIND_STYLE[item.kind]
  const minor = MINOR.has(item.kind)
  const walk = item.kind === 'move' && (item.details.line === 'W' || !item.details.line)
  const railColor = item.details.lineColor ?? (item.kind === 'move' ? 'var(--lw)' : color)
  const mine = meId ? item.checkIns.find((c) => c.userId === meId) : undefined
  const skipped = mine?.skipped === true
  const done = status === 'done' || Boolean(mine)
  const { zoneFor, otherZoneFor } = useTripDisplay()
  // Main time in the zone the KR | TH switch picked; the other one small underneath.
  const mainZone = zoneFor(item.timeZone)
  const otherZone = otherZoneFor(item.timeZone)
  const arrivalZone = zoneFor(item.details.arrivalTimeZone ?? item.timeZone)
  const href = `/trips/${tripId}/items/${item.id}` as Route
  const budget = item.details.budget

  return (
    <li
      id={`item-${item.id}`}
      className={cn(
        'grid scroll-mt-28 grid-cols-[50px_26px_1fr] gap-x-2 rounded-2xl',
        focused && 'animate-[flash_1.6s_ease-out]',
      )}
      style={{ '--node': color } as CSSProperties}
    >
      <div className={cn('pt-3 text-right leading-tight', minor && 'pt-2')}>
        <p className={cn('num text-[15px]', minor && 'text-[13px] text-muted-foreground')}>
          {f.time(item.startsAt, mainZone)}
        </p>
        {/* Away from home: the same moment in the other zone underneath, e.g. "08:00 TH". */}
        {item.timeZone !== homeTimeZone && (
          <p className="text-[10px] leading-tight text-faint">
            {zoneShort(mainZone)}
            <br />
            <span className="tabular-nums">
              {f.time(item.startsAt, otherZone)} {zoneShort(otherZone)}
            </span>
          </p>
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
            borderColor: skipped ? 'var(--lw)' : minor ? railColor : color,
            ...(done && !skipped && { backgroundColor: minor ? railColor : color }),
            ...(skipped && { backgroundColor: 'var(--muted)' }),
          }}
        />
      </div>

      <div className={cn('min-w-0', minor ? 'pb-1' : 'pb-2')}>
        {minor ? (
          <Opener
            href={href}
            onOpen={onOpen && (() => onOpen(item))}
            className="flex min-h-11 w-full items-start gap-2 py-2 text-left text-sm text-muted-foreground active:opacity-70"
          >
            {modeEmoji(item.details.line) && item.details.line !== 'W' ? (
              <span
                className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-[13px]"
                style={{ backgroundColor: `color-mix(in srgb, ${railColor} 22%, transparent)` }}
              >
                {modeEmoji(item.details.line)}
              </span>
            ) : item.details.line && item.details.line !== 'W' ? (
              // A transfer shows every line in order: [PP] › [BL].
              <span className="inline-flex shrink-0 items-center gap-0.5">
                {[item.details.line, ...(item.details.via ?? [])].map((l, i) => (
                  <span key={`${i}:${l}`} className="inline-flex items-center gap-0.5">
                    {i > 0 && <span className="text-xs text-faint">›</span>}
                    <span
                      className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-display text-[13px] font-bold text-white"
                      style={{
                        backgroundColor: i === 0 ? railColor : (presetOf(l)?.color ?? railColor),
                      }}
                    >
                      {lineBadge(l)}
                    </span>
                  </span>
                ))}
              </span>
            ) : (
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="min-w-0">
              <span className="text-foreground">{item.title}</span>
              {item.endsAt && item.kind === 'move' && (
                <span className="ml-1.5 text-xs text-faint">
                  {f.duration(Date.parse(item.endsAt) - Date.parse(item.startsAt))}
                </span>
              )}
              {item.kind === 'move' && (item.details.from || item.details.to) && (
                <span className="block text-xs text-muted-foreground">
                  {item.details.from || '?'} → {item.details.to || '?'}
                </span>
              )}
              {item.notes && <span className="block text-xs text-faint">{item.notes}</span>}
            </span>
          </Opener>
        ) : (
          <Opener
            href={href}
            onOpen={onOpen && (() => onOpen(item))}
            className={cn(
              'my-1.5 block w-full overflow-hidden rounded-2xl border bg-card text-left active:opacity-80',
              item.kind === 'task' && 'border-dashed',
              status === 'now' && 'border-2',
              status === 'done' && !mine && 'opacity-70',
            )}
            style={status === 'now' ? { borderColor: color } : undefined}
          >
            <div className="px-3.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    'font-display text-[17px] leading-snug font-semibold',
                    skipped && 'text-muted-foreground line-through',
                  )}
                >
                  {item.title}
                </p>
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
              </div>
              {(item.endsAt || item.details.flightNumber) && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {item.endsAt &&
                    `${f.time(item.startsAt, mainZone)} – ${f.time(item.endsAt, arrivalZone)}`}
                  {item.details.arrivalTimeZone &&
                    item.details.arrivalTimeZone !== item.timeZone &&
                    ` (${zoneCity(item.details.arrivalTimeZone)})`}
                  {item.details.flightNumber && ` · ${item.details.flightNumber}`}
                  {item.endsAt &&
                    (item.kind === 'flight' || item.kind === 'move') &&
                    ` · ${f.duration(Date.parse(item.endsAt) - Date.parse(item.startsAt))}`}
                </p>
              )}
              {item.kind === 'flight' && (item.details.from || item.details.to) && (
                <p className="mt-0.5 font-display text-[15px] font-semibold">
                  {item.details.from ?? '?'} → {item.details.to ?? '?'}
                  {item.details.terminal && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {t('item.terminal')} {item.details.terminal}
                    </span>
                  )}
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
                {mine &&
                  (skipped ? (
                    <Tag tone="opt">{t('timeline.skipped')}</Tag>
                  ) : (
                    <Tag tone="ok">
                      <Check aria-hidden className="mr-0.5 inline size-3" />
                      {t('item.checkedIn', { time: f.time(mine.checkedInAt, mainZone) })}
                    </Tag>
                  ))}
              </div>
              <MoneyLine budget={budget} spentMinor={spent?.byItem?.get(item.id)} spent={spent} />
            </div>
          </Opener>
        )}
      </div>
    </li>
  )
}

/** A link to the item page, or a button that opens the item sheet. */
function Opener({
  href,
  onOpen,
  className,
  style,
  children,
}: {
  href: Route
  onOpen: (() => void) | undefined
  className: string
  style?: CSSProperties | undefined
  children: ReactNode
}) {
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={className} style={style}>
        {children}
      </button>
    )
  }
  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
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

/**
 * "Budget ₩40,000 (≈ ฿920) · Spent ฿736" under a place, red when over. The trip
 * header switch decides whether the local currency or the trip currency leads.
 */
export function MoneyLine({
  budget,
  spentMinor,
  spent,
}: {
  budget: { amount: string; currency: string } | undefined
  spentMinor: bigint | undefined
  spent: SpentInfo | undefined
}) {
  const t = useTranslations('timeline')
  const { display } = useTripDisplay()
  if (!budget && !spentMinor) return null
  const base = spent?.currency
  const local = budget && budget.currency !== base ? budget.currency : undefined
  // Saved rates come from people (or old backups): only use a positive decimal.
  const saved = local && spent ? spent.rates[local] : undefined
  const rate = saved && /^\d+(\.\d+)?$/.test(saved) && Number(saved) > 0 ? saved : undefined
  const convert = (value: bigint, from: string, to: string, by: string) => {
    try {
      return convertMoney(money(value, from), { from, to, rate: by }).amount
    } catch {
      return null
    }
  }
  const toLocal = (value: bigint) =>
    !local || !rate || !base ? null : convert(value, base, local, (1 / Number(rate)).toFixed(10))
  let budgetMinor: bigint | null = null
  try {
    if (budget) budgetMinor = parseMoney(budget.amount, budget.currency).amount
  } catch {
    budgetMinor = null
  }
  // The budget in the trip currency: as is when it already is, converted when a rate is saved.
  const budgetBase =
    !budget || budgetMinor === null || !base
      ? null
      : budget.currency === base
        ? budgetMinor
        : rate
          ? convert(budgetMinor, budget.currency, base, rate)
          : null
  const over = budgetBase !== null && spentMinor !== undefined && spentMinor > budgetBase
  const localFirst = display.money === 'local' && local !== undefined && rate !== undefined

  const show = (baseValue: bigint | null, localValue: bigint | null) => {
    const b = baseValue !== null && base ? formatMoney(money(baseValue, base)) : null
    const l = localValue !== null && local ? formatMoney(money(localValue, local)) : null
    const [first, second] = localFirst ? [l, b] : [b ?? l, b ? l : null]
    return (
      <span className="num">
        {first}
        {second && <span className="ml-1 font-normal text-faint">(≈ {second})</span>}
      </span>
    )
  }

  return (
    <div className="mt-2 space-y-0.5 border-t pt-2 text-[13px]">
      {budget && (
        <p className="flex justify-between gap-2">
          <span className="text-muted-foreground">{t('budget')}</span>
          {budgetMinor === null ? (
            <span className="num">{budgetText(budget)}</span>
          ) : (
            show(budgetBase, local ? budgetMinor : null)
          )}
        </p>
      )}
      {spentMinor !== undefined && spent && (
        <p className={cn('flex justify-between gap-2', over && 'font-semibold text-danger')}>
          <span className={over ? undefined : 'text-muted-foreground'}>{t('spent')}</span>
          {show(spentMinor, toLocal(spentMinor))}
        </p>
      )}
    </div>
  )
}
