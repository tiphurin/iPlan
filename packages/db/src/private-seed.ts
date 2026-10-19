/**
 * Format of a private seed file (packages/db/seed/private/*.json, gitignored).
 * It holds a real trip with real people and bookings, so it never enters git;
 * `yarn db:seed:private` loads every file in that folder.
 */
import { fromLocalInput, isValidTimeZone } from '@iplan/core'

export interface PrivateSeedFile {
  format: 'iplan.private-seed'
  version: 1
  /** `key` is how the rest of the file refers to a person (e.g. "A", "B"). */
  users: { key: string; name: string; email: string; admin?: boolean; groups?: string[] }[]
  trip: {
    /** Fixed id so re-running replaces the trip instead of duplicating it. */
    id: string
    name: string
    destination?: string
    startDate: string
    endDate: string
    homeTimeZone: string
    baseCurrency: string
    /** Units of base currency per 1 unit of foreign currency, e.g. { "KRW": "0.023" }. */
    fxRates?: Record<string, string>
    dailyBudget?: string
    owner: string
    /** Other members by user key → role. */
    members?: Record<string, 'editor' | 'viewer'>
  }
  items: {
    /** The trip day this item is listed under. */
    day: string
    kind: 'place' | 'move' | 'flight' | 'task' | 'wake' | 'sleep'
    title: string
    /** Zone of `start` (and `end` unless `endTz` is given). */
    tz: string
    /** Local date-time "YYYY-MM-DDTHH:MM", or just "HH:MM" on `day`. */
    start: string
    end?: string
    endTz?: string
    notes?: string
    details?: Record<string, unknown>
  }[]
  checklist?: { group: string; title: string }[]
  infoCards?: {
    kind: 'flight' | 'hotel' | 'health' | 'lounge' | 'emergency' | 'tip' | 'other'
    title: string
    body: string
  }[]
}

export interface BuiltItem {
  dayDate: string
  kind: PrivateSeedFile['items'][number]['kind']
  title: string
  startsAt: Date
  endsAt: Date | null
  timeZone: string
  notes: string | null
  details: Record<string, unknown>
  sortOrder: number
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

function localInput(day: string, value: string): string {
  if (TIME.test(value)) return `${day}T${value}`
  return value
}

/** Validates the file and turns local times into instants. Throws with the item's title. */
export function buildPrivateItems(file: PrivateSeedFile): BuiltItem[] {
  if (file.format !== 'iplan.private-seed' || file.version !== 1) {
    throw new Error('Not an iplan.private-seed v1 file')
  }
  const { startDate, endDate } = file.trip
  return file.items.map((item, sortOrder) => {
    const where = `"${item.title}" (${item.day} ${item.start})`
    if (!DATE.test(item.day) || item.day < startDate || item.day > endDate) {
      throw new Error(`${where}: day is outside the trip`)
    }
    if (!isValidTimeZone(item.tz) || (item.endTz && !isValidTimeZone(item.endTz))) {
      throw new Error(`${where}: unknown time zone`)
    }
    const startsAt = fromLocalInput(localInput(item.day, item.start), item.tz)
    const endsAt = item.end
      ? fromLocalInput(localInput(item.day, item.end), item.endTz ?? item.tz)
      : null
    if (endsAt && endsAt.getTime() < startsAt.getTime()) {
      throw new Error(`${where}: ends before it starts`)
    }
    return {
      dayDate: item.day,
      kind: item.kind,
      title: item.title,
      startsAt,
      endsAt,
      timeZone: item.tz,
      notes: item.notes ?? null,
      details: item.details ?? {},
      sortOrder,
    }
  })
}
