import type { TripItemDto } from '@iplan/contracts'

const stamp = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** "Add to Google Calendar" link for one plan item (times in UTC). */
export function googleCalendarUrl(
  item: Pick<TripItemDto, 'title' | 'startsAt' | 'endsAt' | 'notes' | 'details'>,
): string {
  const end = item.endsAt ?? new Date(new Date(item.startsAt).getTime() + 15 * 60_000).toISOString()
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.title,
    dates: `${stamp(item.startsAt)}/${stamp(end)}`,
  })
  if (item.notes) params.set('details', item.notes)
  if (item.details.address) params.set('location', item.details.address)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
