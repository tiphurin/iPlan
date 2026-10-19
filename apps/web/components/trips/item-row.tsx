'use client'

import type { TripItemDto } from '@iplan/contracts'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { KIND_STYLE } from '@/lib/item-kinds'
import { lineBadge } from '@/lib/lines'
import { zoneCity } from '@/lib/time-zones'
import { useFormat } from '@/lib/use-format'

export type RowStatus = 'done' | 'now' | 'upcoming' | null

/** One line of the itinerary: time column, kind icon, title and key details. */
export function ItemRow({
  item,
  homeTimeZone,
  status = null,
  meId,
}: {
  item: TripItemDto
  homeTimeZone: string
  status?: RowStatus
  meId?: string
}) {
  const t = useTranslations()
  const f = useFormat()
  const { icon: Icon, tone } = KIND_STYLE[item.kind]
  const arrivalZone = item.details.arrivalTimeZone ?? item.timeZone
  const showZone = item.timeZone !== homeTimeZone
  const mine = meId ? item.checkIns.find((c) => c.userId === meId) : undefined

  return (
    <div
      className={cn(
        'flex gap-3 rounded-2xl border bg-card p-3',
        status === 'now' && 'border-primary ring-2 ring-primary/20',
        status === 'done' && 'opacity-70',
      )}
    >
      <div className="w-14 shrink-0 pt-0.5 text-right tabular-nums">
        <p className="text-[15px] font-semibold">{f.time(item.startsAt, item.timeZone)}</p>
        {item.endsAt && (
          <p className="text-xs text-muted-foreground">{f.time(item.endsAt, arrivalZone)}</p>
        )}
        {showZone && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {zoneCity(item.timeZone)}
          </p>
        )}
      </div>
      <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon aria-hidden className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{item.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{t(`kinds.${item.kind}`)}</span>
          {item.details.line && (
            <span
              className="rounded-full px-2 py-0.5 font-semibold text-white"
              style={{ backgroundColor: item.details.lineColor ?? '#64748b' }}
            >
              {[item.details.line, ...(item.details.via ?? [])].map(lineBadge).join(' › ')}
            </span>
          )}
          {item.kind === 'move' && (item.details.from || item.details.to) && (
            <span>
              {item.details.from || '?'} → {item.details.to || '?'}
            </span>
          )}
          {item.details.flightNumber && <span>{item.details.flightNumber}</span>}
          {item.details.arrivalTimeZone && item.details.arrivalTimeZone !== item.timeZone && (
            <span>→ {zoneCity(item.details.arrivalTimeZone)}</span>
          )}
          {item.details.address && <span className="truncate">{item.details.address}</span>}
        </div>
        {(mine || status) && (
          <p className="mt-1 flex items-center gap-1 text-xs">
            {mine ? (
              <span className="flex items-center gap-1 text-success">
                <Check aria-hidden className="size-3.5" />
                {t('item.checkedIn', { time: f.time(mine.checkedInAt, item.timeZone) })}
              </span>
            ) : status === 'now' ? (
              <span className="font-semibold text-primary">{t('todayView.status.now')}</span>
            ) : null}
          </p>
        )}
      </div>
    </div>
  )
}
