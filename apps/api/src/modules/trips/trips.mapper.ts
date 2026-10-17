import type { TripDetailDto, TripDto } from '@iplan/contracts'
import type { MemberRow, TripWithRole } from './trips.repository'

export function toTripDto({ trip, role, memberCount }: TripWithRole): TripDto {
  return {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    homeTimeZone: trip.homeTimeZone,
    baseCurrency: trip.baseCurrency,
    role,
    memberCount,
  }
}

export function toTripDetailDto(found: TripWithRole, members: MemberRow[]): TripDetailDto {
  return { ...toTripDto(found), members }
}
