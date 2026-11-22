/**
 * Arithmetic on wall-clock values "YYYY-MM-DDTHH:mm" (no zone): the time picker
 * works in the item's own zone, so "+15 minutes" is plain calendar arithmetic.
 */

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

const pad = (n: number) => String(n).padStart(2, '0')

function toUtcMs(value: string): number | null {
  const m = LOCAL.exec(value)
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi))
}

function fromUtcMs(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}`
}

/** "2026-10-24T23:50" + 20 → "2026-10-25T00:10". Null for a malformed value. */
export function addMinutesLocal(value: string, minutes: number): string | null {
  const ms = toUtcMs(value)
  return ms === null ? null : fromUtcMs(ms + minutes * 60_000)
}

/** Whole minutes from `a` to `b` (negative when `b` is earlier). */
export function minutesBetweenLocal(a: string, b: string): number | null {
  const from = toUtcMs(a)
  const to = toUtcMs(b)
  return from === null || to === null ? null : Math.round((to - from) / 60_000)
}

/**
 * What people type into a time box, as "HH:mm": "1015", "10:15", "10.15" and
 * "915" (09:15); one or two digits are a whole hour ("9" → 09:00). Null when
 * it isn't a time of day.
 */
export function parseTypedTime(text: string): string | null {
  const trimmed = text.trim()
  let hour: number
  let minute: number
  const parts = /^(\d{1,2})[:.](\d{2})$/.exec(trimmed)
  if (parts) {
    hour = Number(parts[1])
    minute = Number(parts[2])
  } else if (/^\d{1,4}$/.test(trimmed)) {
    if (trimmed.length <= 2) {
      hour = Number(trimmed)
      minute = 0
    } else {
      hour = Number(trimmed.slice(0, -2))
      minute = Number(trimmed.slice(-2))
    }
  } else {
    return null
  }
  if (hour > 23 || minute > 59) return null
  return `${pad(hour)}:${pad(minute)}`
}
