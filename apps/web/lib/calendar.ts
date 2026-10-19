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

/**
 * Calendar apps that sync through iCloud or Google fetch the feed from the
 * internet, so a link to this computer (localhost, a Wi-Fi address, plain http)
 * can't be subscribed there until the app is deployed.
 */
export function isPrivateFeed(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return (
      protocol !== 'https:' ||
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
    )
  } catch {
    return true
  }
}
