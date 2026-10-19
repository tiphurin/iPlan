'use client'

import type { TripDetailDto, TripItemDto } from '@iplan/contracts'
import { CalendarPlus, Check, ExternalLink, MapPin, Pencil, Phone, Wallet } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Attachments } from '@/components/attachments'
import { buttonVariants } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { googleCalendarUrl } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { mapLinks } from '@/lib/maps'
import { zoneShort } from '@/lib/time-zones'
import { useTripDisplay } from '@/lib/trip-display'
import { useFormat } from '@/lib/use-format'
import { MoneyLine, type SpentInfo } from './timeline'

/**
 * Everything about one plan item, opened over the timeline like an event in
 * Apple Calendar: no page change, so closing it keeps your place.
 */
export function ItemSheet({
  item,
  trip,
  spent,
  onClose,
}: {
  item: TripItemDto | null
  trip: TripDetailDto
  spent?: SpentInfo | undefined
  onClose: () => void
}) {
  const t = useTranslations()
  const f = useFormat()
  const { zoneFor } = useTripDisplay()
  if (!item) return null
  const canEdit = trip.role !== 'viewer'
  const zone = zoneFor(item.timeZone)
  const endZone = zoneFor(item.details.arrivalTimeZone ?? item.timeZone)
  const { lat, lng } = item.details
  const place = item.details.address ?? (item.kind === 'place' ? item.title : null)
  const links = place
    ? mapLinks(place, typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : undefined)
    : null
  const canSpend = canEdit && item.kind !== 'wake' && item.kind !== 'sleep'

  return (
    <Sheet open onClose={onClose} title={item.title}>
      <div className="space-y-4">
        <p className="text-[15px] text-muted-foreground">
          {t(`kinds.${item.kind}`)} · {f.day(item.dayDate)} · {f.time(item.startsAt, zone)}
          {item.endsAt && ` – ${f.time(item.endsAt, endZone)}`} {zoneShort(zone)}
          {item.details.flightNumber && ` · ${item.details.flightNumber}`}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {canEdit && (
            <Link
              href={`/trips/${trip.id}/items/${item.id}` as Route}
              className={buttonVariants({ variant: 'solid' })}
            >
              <Pencil aria-hidden className="size-4" />
              {t('itemSheet.edit')}
            </Link>
          )}
          {canSpend && (
            <Link
              href={`/trips/${trip.id}/expenses/new?item=${item.id}` as Route}
              className={buttonVariants({ variant: 'secondary' })}
            >
              <Wallet aria-hidden className="size-4 text-l1" />
              {t('itemSheet.expense')}
            </Link>
          )}
        </div>

        {item.notes && <p className="whitespace-pre-line">{item.notes}</p>}

        {(item.details.budget || spent?.byItem?.get(item.id)) && (
          <MoneyLine
            budget={item.details.budget}
            spentMinor={spent?.byItem?.get(item.id)}
            spent={spent}
          />
        )}

        {(place || item.details.phone || item.details.hours || item.details.url) && (
          <div className="space-y-2 rounded-2xl bg-muted/60 p-3 text-sm">
            {item.details.address && (
              <p className="flex gap-2">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-l3" />
                {item.details.address}
              </p>
            )}
            {item.details.hours && <p className="pl-6">{item.details.hours}</p>}
            {item.details.phone && (
              <a href={`tel:${item.details.phone}`} className="flex gap-2 text-la">
                <Phone aria-hidden className="mt-0.5 size-4 shrink-0" />
                {item.details.phone}
              </a>
            )}
            {item.details.url && (
              <a
                href={item.details.url}
                target="_blank"
                rel="noreferrer"
                className="flex gap-2 break-all text-la"
              >
                <ExternalLink aria-hidden className="mt-0.5 size-4 shrink-0" />
                {item.details.url}
              </a>
            )}
            {links && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(
                  [
                    ['Apple', links.apple],
                    ['Google', links.google],
                    ['Naver', links.naver],
                  ] as const
                ).map(([name, href]) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({
                      variant: 'secondary',
                      className: 'min-h-10 text-sm',
                    })}
                  >
                    {name}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <a
            href={`/api/trips/${trip.id}/items/${item.id}/event.ics`}
            className={buttonVariants({ variant: 'outline' })}
          >
            <CalendarPlus aria-hidden className="size-4" />
            {t('itemCalendar.apple')}
          </a>
          <a
            href={googleCalendarUrl(item)}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            <CalendarPlus aria-hidden className="size-4" />
            {t('itemCalendar.google')}
          </a>
        </div>

        {item.checkIns.length > 0 && (
          <ul className="space-y-1 text-sm">
            {item.checkIns.map((c) => (
              <li
                key={c.userId}
                className={cn(
                  'flex items-center gap-1.5',
                  c.skipped ? 'text-faint' : 'text-success',
                )}
              >
                <Check aria-hidden className="size-4" />
                {c.name} ·{' '}
                {c.skipped
                  ? t('timeline.skipped')
                  : t('item.checkedIn', { time: f.time(c.checkedInAt, zone) })}
              </li>
            ))}
          </ul>
        )}

        <Attachments entityType="trip_item" entityId={item.id} canEdit={canEdit} kind="photo" />
      </div>
    </Sheet>
  )
}
