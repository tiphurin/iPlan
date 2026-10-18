import type { TripDto } from '@iplan/contracts'

/** All dates from start to end inclusive ("YYYY-MM-DD"). */
export function tripDays(startDate: string, endDate: string): string[] {
  const days: string[] = []
  for (
    let t = Date.parse(`${startDate}T00:00:00Z`);
    t <= Date.parse(`${endDate}T00:00:00Z`);
    t += 86_400_000
  ) {
    days.push(new Date(t).toISOString().slice(0, 10))
  }
  return days
}

export type TripPhase = 'ongoing' | 'upcoming' | 'past'

export function tripPhase(trip: Pick<TripDto, 'startDate' | 'endDate'>, today: string): TripPhase {
  if (today < trip.startDate) return 'upcoming'
  if (today > trip.endDate) return 'past'
  return 'ongoing'
}
