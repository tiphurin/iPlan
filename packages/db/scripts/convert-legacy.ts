/**
 * Converts the old single-file prototype (legacy/seoul-trip.html) into an
 * iplan.trip v1 file that the app can import (Trips → Import trip from file).
 *
 *   yarn legacy:convert legacy/seoul-trip.html [seoul26-backup.json] > my-trip.iplan.json
 *
 * The prototype keeps its default plan, checklist and info cards in code and
 * only stores your edits, so both are read: built-in defaults from the HTML,
 * then edits from an optional backup (the prototype's "Backup JSON" button).
 * Everything stays on your machine; nothing is uploaded or committed.
 */
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { fromLocalInput } from '@iplan/core'

interface LegacyItem {
  id: string
  day: number
  t: string
  kind: string
  title: string
  desc?: string
  end?: string
  tz?: 'TH' | 'KR'
  l?: string
  q?: string
  kr?: string
  addr?: string
  phone?: string
  url?: string
  hours?: string
  deleted?: boolean
}

const ZONE = { TH: 'Asia/Bangkok', KR: 'Asia/Seoul' } as const
const LINE_COLOR: Record<string, string> = {
  '1': '#0052A4',
  '2': '#00A84D',
  '3': '#EF7C1C',
  '5': '#996CAC',
  A: '#0090D2',
  W: '#9AA3AE',
  car: '#4A5563',
}
const GROUP: Record<string, string> = {
  docs: 'documents',
  book: 'bookings',
  money: 'money',
  pack: 'packing',
  clothes: 'clothes',
  airport: 'airport',
  d1: 'day-1',
  d2: 'day-2',
  d3: 'day-3',
  back: 'return',
}
const KINDS = new Set(['place', 'move', 'flight', 'task', 'wake', 'sleep'])

function readDefaults(html: string) {
  const start = html.indexOf('const DAYS = [')
  const end = html.indexOf('const SIMS')
  if (start < 0 || end < 0) throw new Error('This does not look like the Seoul prototype file')
  const code = `${html.slice(start, end)}\n({ DAYS, DEFAULT_PLAN, DEFAULT_CHECK, DEFAULT_INFO, LINE_NAME })`
  // Only constant definitions run, in an empty sandbox.
  return runInContext(code, createContext({ encodeURIComponent }), { timeout: 1000 }) as {
    DAYS: { n: number; date: string; tz: 'TH' | 'KR' }[]
    DEFAULT_PLAN: LegacyItem[]
    DEFAULT_CHECK: { id: string; g: string; t: string }[]
    DEFAULT_INFO: { id: string; ord: number; title: string; body: string; links?: string }[]
    LINE_NAME: Record<string, string>
  }
}

function addDay(date: string): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
}

function mergeById<T extends { id: string; deleted?: boolean }>(
  defaults: T[],
  edits: Partial<T>[],
): T[] {
  const map = new Map(defaults.map((d) => [d.id, { ...d }]))
  for (const edit of edits) {
    if (!edit.id) continue
    if (edit.deleted) map.delete(edit.id)
    else map.set(edit.id, { ...(map.get(edit.id) ?? ({} as T)), ...edit } as T)
  }
  return [...map.values()]
}

function main() {
  const [htmlPath, backupPath] = process.argv.slice(2)
  if (!htmlPath) {
    console.error(
      'Usage: yarn legacy:convert legacy/seoul-trip.html [backup.json] > trip.iplan.json',
    )
    process.exit(1)
  }
  const defaults = readDefaults(readFileSync(htmlPath, 'utf8'))
  const backup = backupPath
    ? (JSON.parse(readFileSync(backupPath, 'utf8')) as Record<string, unknown[]>)
    : {}
  const meta = (backup.meta?.[0] ?? {}) as { rate?: number | string }

  const plan = mergeById(defaults.DEFAULT_PLAN, (backup.plan ?? []) as Partial<LegacyItem>[])
  const days = defaults.DAYS
  const items = plan
    .filter((p) => days[p.day] && KINDS.has(p.kind))
    .map((p) => {
      const day = days[p.day] as { date: string; tz: 'TH' | 'KR' }
      const zone = ZONE[p.tz ?? day.tz]
      const startsAt = fromLocalInput(`${day.date}T${p.t || '00:00'}`, zone)
      let endsAt: Date | null = null
      if (p.end) {
        endsAt = fromLocalInput(`${day.date}T${p.end}`, zone)
        if (endsAt <= startsAt) endsAt = fromLocalInput(`${addDay(day.date)}T${p.end}`, zone)
      }
      const details: Record<string, string> = {}
      const address = p.addr ?? p.q
      if (address) details.address = address
      if (p.phone) details.phone = p.phone
      if (p.url) details.url = p.url
      if (p.hours) details.hours = p.hours
      if (p.l) {
        details.line = defaults.LINE_NAME[p.l] ?? p.l
        const color = LINE_COLOR[p.l]
        if (color) details.lineColor = color
      }
      const notes = [p.desc, p.kr].filter(Boolean).join('\n')
      return {
        dayDate: day.date,
        kind: p.kind,
        title: p.title,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt?.toISOString() ?? null,
        timeZone: zone,
        notes: notes || null,
        details,
      }
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  // A flight lands in the zone of whatever comes after it (BKK → Seoul).
  items.forEach((item, index) => {
    const next = items.slice(index + 1).find((i) => i.timeZone !== item.timeZone)
    if (item.kind === 'flight' && next && items[index + 1]?.timeZone !== item.timeZone) {
      item.details.arrivalTimeZone = next.timeZone
    }
  })

  const checklist = mergeById(
    defaults.DEFAULT_CHECK,
    (backup.clist ?? []) as Partial<{ id: string; g: string; t: string; deleted?: boolean }>[],
  ).map((c) => ({ groupKey: GROUP[c.g] ?? 'other', title: c.t }))

  const info = mergeById(
    defaults.DEFAULT_INFO,
    (backup.info ?? []) as Partial<{
      id: string
      ord: number
      title: string
      body: string
      links?: string
      deleted?: boolean
    }>[],
  )
    .sort((a, b) => a.ord - b.ord)
    .map((c) => ({
      kind: /flight/.test(c.id)
        ? 'flight'
        : /hotel/.test(c.id)
          ? 'hotel'
          : /clinic/.test(c.id)
            ? 'health'
            : /lounge/.test(c.id)
              ? 'lounge'
              : /emerg|sos/.test(c.id)
                ? 'emergency'
                : 'tip',
      title: c.title,
      body: [c.body, c.links].filter(Boolean).join('\n\n').slice(0, 4000),
    }))

  const first = days[0]?.date ?? ''
  const last = days.at(-1)?.date ?? first
  // The prototype stores baht per ₩1,000.
  const perThousand = Number(meta.rate ?? 0)
  const output = {
    format: 'iplan.trip',
    version: 1,
    exportedAt: new Date().toISOString(),
    trip: {
      name: 'Seoul',
      destination: 'Seoul, South Korea',
      startDate: first,
      endDate: last,
      homeTimeZone: 'Asia/Bangkok',
      baseCurrency: 'THB',
      fxRates: perThousand > 0 ? { KRW: String(perThousand / 1000) } : {},
      dailyBudget: null,
    },
    items,
    checklist,
    infoCards: info,
    expenses: [],
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
  console.error(
    `Converted ${items.length} plan items, ${checklist.length} checklist items, ${info.length} info cards.`,
  )
}

main()
