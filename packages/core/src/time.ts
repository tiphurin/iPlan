/**
 * Time-zone helpers. Instants are stored in UTC; each trip item carries an IANA
 * zone (Asia/Bangkok, Asia/Seoul) used for display and for form input.
 */
export class TimeZoneError extends Error {
  override readonly name = 'TimeZoneError'
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatterCache.set(timeZone, formatter)
  }
  return formatter
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    partsFormatter(timeZone)
    return true
  } catch {
    return false
  }
}

export interface ZonedParts {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
  readonly second: number
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  if (!isValidTimeZone(timeZone)) throw new TimeZoneError(`Unknown time zone: ${timeZone}`)
  const values: Record<string, number> = {}
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value)
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  }
}

/** Offset from UTC in minutes at that instant (Asia/Seoul → 540). */
export function offsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const truncated = Math.floor(date.getTime() / 1000) * 1000
  return Math.round((asUtc - truncated) / 60_000)
}

/** "UTC+7", "UTC+5:30", "UTC-3". */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const hours = Math.floor(abs / 60)
  const mins = abs % 60
  return `UTC${sign}${hours}${mins ? `:${String(mins).padStart(2, '0')}` : ''}`
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** Calendar date in that zone as "YYYY-MM-DD". */
export function localDateKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone)
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`
}

/** Value for <input type="datetime-local">: "YYYY-MM-DDTHH:mm" in that zone. */
export function toLocalInput(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone)
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * Wall-clock time in a zone → UTC instant. Times skipped by a DST jump resolve
 * forward; repeated times resolve to the earlier instant.
 */
export function fromLocalInput(value: string, timeZone: string): Date {
  const match = LOCAL_INPUT.exec(value)
  if (!match) throw new TimeZoneError(`Invalid local date-time: ${value}`)
  const [, y, mo, d, h, mi, s = '0'] = match
  const wallAsUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  // Offsets a day either side cover both sides of any DST transition.
  const offsets = new Set(
    [-86_400_000, 0, 86_400_000].map((shift) =>
      offsetMinutes(new Date(wallAsUtc + shift), timeZone),
    ),
  )
  const candidates = [...offsets].map((offset) => wallAsUtc - offset * 60_000)
  const exact = candidates.filter((instant) => {
    const p = zonedParts(new Date(instant), timeZone)
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) === wallAsUtc
  })
  // Repeated wall time → earlier instant; skipped wall time → shift forward past the gap.
  return new Date(exact.length > 0 ? Math.min(...exact) : Math.max(...candidates))
}
