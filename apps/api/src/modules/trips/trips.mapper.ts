import type { TripDetailDto, TripDto } from '@iplan/contracts'
import type { MemberRow, TripWithRole } from './trips.repository'

/** API path of the cover photo, versioned by its key so a new photo busts caches. */
export function tripCoverUrl(tripId: string, coverKey: string | null): string | null {
  if (!coverKey) return null
  const version =
    coverKey
      .split('/')
      .pop()
      ?.split('.')[0]
      ?.replace(/^cover-/, '') ?? ''
  return `/api/trips/${encodeURIComponent(tripId)}/cover?v=${version}`
}

export function toTripDto({ trip, role, memberCount }: TripWithRole): TripDto {
  return {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    homeTimeZone: trip.homeTimeZone,
    baseCurrency: trip.baseCurrency,
    fxRates: trip.fxRates,
    dailyBudgetMinor: trip.dailyBudgetMinor?.toString() ?? null,
    color: trip.color,
    coverUrl: tripCoverUrl(trip.id, trip.coverKey),
    role,
    memberCount,
  }
}

export function toTripDetailDto(found: TripWithRole, members: MemberRow[]): TripDetailDto {
  return { ...toTripDto(found), members }
}
