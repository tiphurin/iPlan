import type { TripDto } from '@iplan/contracts'
import { type Locale, formatDateRange, todayKey } from '@iplan/i18n'
import { Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/cn'
import { coverColor, daysBetween } from '@/lib/trip-color'
import { tripPhase } from '@/lib/trip-dates'

/** Trip card like the prototype's place covers: the cover photo, else its colour. Server component. */
export async function TripCover({
  trip,
  locale,
  className,
}: {
  trip: TripDto
  locale: Locale
  className?: string
}) {
  const t = await getTranslations('trips')
  const today = todayKey(trip.homeTimeZone)
  const phase = tripPhase(trip, today)
  const until = daysBetween(today, trip.startDate)
  const dayN = daysBetween(trip.startDate, today) + 1
  return (
    <div
      className={cn(
        'relative flex min-h-[132px] flex-col justify-end overflow-hidden rounded-2xl p-4 text-white',
        phase === 'past' && 'opacity-75 grayscale-[35%]',
        className,
      )}
      style={{ backgroundColor: coverColor(trip) }}
    >
      {trip.coverUrl ? (
        <>
          {/* The colour behind shows while the photo loads (or if it fails). */}
          {/* eslint-disable-next-line @next/next/no-img-element -- permission-checked API image */}
          <img
            src={trip.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-linear-to-t from-black/70 via-black/25 to-black/10"
          />
        </>
      ) : (
        <>
          <span
            aria-hidden
            className="absolute -top-7 -right-5 size-[120px] rounded-full border-[16px] border-white/20"
          />
          <span
            aria-hidden
            className="absolute top-10 right-14 size-[46px] rounded-full border-8 border-white/16"
          />
        </>
      )}
      <span className="absolute top-3 left-4 rounded-full bg-black/25 px-2.5 py-0.5 text-xs font-medium">
        {phase === 'ongoing'
          ? t('onDay', { n: dayN })
          : phase === 'upcoming'
            ? t('startsIn', { count: until })
            : t('ended')}
      </span>
      <p className="relative font-display text-2xl leading-tight font-bold [text-shadow:0_1px_6px_rgba(0,0,0,.25)]">
        {trip.name}
      </p>
      <p className="relative mt-0.5 text-sm opacity-95">
        {formatDateRange(trip.startDate, trip.endDate, { locale })}
        {trip.destination && ` · ${trip.destination}`}
      </p>
      <p className="relative mt-1 flex items-center gap-1.5 text-xs opacity-90">
        <Users aria-hidden className="size-3.5" />
        {t('members', { count: trip.memberCount })} · {t(`role.${trip.role}`)}
      </p>
    </div>
  )
}
