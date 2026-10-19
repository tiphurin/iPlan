/**
 * Minimal iCalendar (RFC 5545) writer for trip plans. Times are written in UTC
 * so every calendar app shows them correctly in its own time zone.
 */
export interface IcsEvent {
  uid: string
  title: string
  start: Date
  end?: Date | null
  location?: string | undefined
  /** Map pin; Apple Calendar also shows travel time with it. */
  geo?: { lat: number; lng: number } | undefined
  description?: string | undefined
  /** Last change; lets calendars replace an older copy of the same event (same UID). */
  updatedAt?: Date | undefined
}

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** Escape per RFC 5545 §3.3.11. */
export function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Fold lines longer than 75 octets, never splitting a multi-byte character. */
export function fold(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const bytes = encoder.encode(ch).length
    const limit = parts.length === 0 ? 75 : 74
    if (size + bytes > limit) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += bytes
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export function buildIcs(calendarName: string, events: IcsEvent[], now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//iPlan//Trip plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(calendarName)}`,
  ]
  for (const e of events) {
    // Instant items (no end) get 15 minutes so they are visible in day views.
    const end = e.end ?? new Date(e.start.getTime() + 15 * 60_000)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${icsText(e.title)}`,
      ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
      ...(e.geo
        ? [
            `GEO:${e.geo.lat};${e.geo.lng}`,
            `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-APPLE-RADIUS=100;X-TITLE="${(
              e.location ?? e.title
            ).replace(/["\r\n]/g, ' ')}":geo:${e.geo.lat},${e.geo.lng}`,
          ]
        : []),
      ...(e.description ? [`DESCRIPTION:${icsText(e.description)}`] : []),
      ...(e.updatedAt
        ? [
            `LAST-MODIFIED:${stamp(e.updatedAt)}`,
            `SEQUENCE:${Math.floor(e.updatedAt.getTime() / 1000)}`,
          ]
        : []),
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}
