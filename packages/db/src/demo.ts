/**
 * Fictional demo data. Dates are relative to "today" so the live Today screen
 * always has something happening. No real bookings or people: this repo is public.
 */
import { fromLocalInput } from '@iplan/core'

export const DEMO_TRIP_ID = '00000000-0000-4000-8000-000000000001'

export const DEMO_USERS = [
  { id: 'demo-owner', name: 'Demo Owner', email: 'dev@iplan.local', role: 'admin' },
  { id: 'demo-friend', name: 'Demo Friend', email: 'friend@iplan.local', role: 'user' },
] as const

const BKK = 'Asia/Bangkok'
const SEL = 'Asia/Seoul'

type Kind = 'place' | 'move' | 'flight' | 'task' | 'wake' | 'sleep'

interface ItemSpec {
  /** Day index from the trip start. */
  day: number
  kind: Kind
  title: string
  tz: string
  start: string
  /** The start falls after midnight but still belongs to `day` (e.g. a 02:25 departure). */
  startsNextDay?: true
  /** End time; `+1` day offset and a zone can be given for overnight flights. */
  end?: { time: string; dayOffset?: number; tz?: string }
  notes?: string
  details?: Record<string, unknown>
}

const line = (name: string, color: string) => ({ line: name, lineColor: color })

const ITINERARY: ItemSpec[] = [
  // Day 0: prep day at home
  { day: 0, kind: 'wake', title: 'Wake up', tz: BKK, start: '07:00' },
  { day: 0, kind: 'task', title: 'Pack bags', tz: BKK, start: '09:00', end: { time: '10:30' } },
  {
    day: 0,
    kind: 'task',
    title: 'Exchange KRW cash',
    tz: BKK,
    start: '13:00',
    end: { time: '14:00' },
  },
  {
    day: 0,
    kind: 'place',
    title: 'Dinner near home',
    tz: BKK,
    start: '19:00',
    end: { time: '20:30' },
  },
  {
    day: 0,
    kind: 'move',
    title: 'Taxi to Suvarnabhumi Airport',
    tz: BKK,
    start: '22:15',
    end: { time: '23:15' },
  },
  {
    day: 0,
    kind: 'place',
    title: 'Airport lounge',
    tz: BKK,
    start: '23:30',
    end: { time: '01:15', dayOffset: 1 },
    details: { terminal: 'Concourse D' },
  },
  {
    day: 0,
    kind: 'flight',
    title: 'Flight BKK → ICN',
    tz: BKK,
    start: '02:25',
    startsNextDay: true,
    end: { time: '10:00', tz: SEL },
    details: { flightNumber: 'DM 101', from: 'BKK', to: 'ICN', arrivalTimeZone: SEL },
  },
  // Day 1: arrival in Seoul
  {
    day: 1,
    kind: 'move',
    title: 'AREX to Seoul Station',
    tz: SEL,
    start: '10:45',
    end: { time: '11:50' },
    details: line('AREX', '#0090D2'),
  },
  {
    day: 1,
    kind: 'move',
    title: 'Line 2 to Sinchon',
    tz: SEL,
    start: '12:00',
    end: { time: '12:25' },
    details: line('2', '#00A84D'),
  },
  {
    day: 1,
    kind: 'place',
    title: 'Hotel: drop luggage',
    tz: SEL,
    start: '12:30',
    end: { time: '13:00' },
    details: { address: 'Sinchon, Seodaemun-gu, Seoul' },
  },
  {
    day: 1,
    kind: 'place',
    title: 'Lunch: dakgalbi',
    tz: SEL,
    start: '13:00',
    end: { time: '14:00' },
    details: { budget: { amount: '30000', currency: 'KRW' } },
  },
  {
    day: 1,
    kind: 'place',
    title: 'Gyeongbokgung Palace',
    tz: SEL,
    start: '14:30',
    end: { time: '17:30' },
    details: { hours: '09:00–18:00', address: '161 Sajik-ro, Jongno-gu, Seoul' },
  },
  {
    day: 1,
    kind: 'place',
    title: 'Dinner: Gwangjang Market',
    tz: SEL,
    start: '18:00',
    end: { time: '19:30' },
  },
  {
    day: 1,
    kind: 'place',
    title: 'Cheonggyecheon stream walk',
    tz: SEL,
    start: '20:00',
    end: { time: '21:30' },
  },
  { day: 1, kind: 'sleep', title: 'Sleep', tz: SEL, start: '23:00' },
  // Day 2
  { day: 2, kind: 'wake', title: 'Wake up', tz: SEL, start: '07:30' },
  {
    day: 2,
    kind: 'place',
    title: 'Bukchon Hanok Village',
    tz: SEL,
    start: '09:00',
    end: { time: '11:00' },
  },
  {
    day: 2,
    kind: 'place',
    title: 'Lunch in Insadong',
    tz: SEL,
    start: '11:30',
    end: { time: '13:00' },
  },
  {
    day: 2,
    kind: 'move',
    title: 'Line 4 to Myeongdong',
    tz: SEL,
    start: '13:00',
    end: { time: '13:30' },
    details: line('4', '#00A5DE'),
  },
  {
    day: 2,
    kind: 'place',
    title: 'Myeongdong shopping',
    tz: SEL,
    start: '13:30',
    end: { time: '17:00' },
  },
  {
    day: 2,
    kind: 'place',
    title: 'N Seoul Tower',
    tz: SEL,
    start: '18:00',
    end: { time: '20:30' },
  },
  { day: 2, kind: 'sleep', title: 'Sleep', tz: SEL, start: '23:30' },
  // Day 3
  { day: 3, kind: 'wake', title: 'Wake up', tz: SEL, start: '08:00' },
  {
    day: 3,
    kind: 'move',
    title: 'Line 2 to Samseong',
    tz: SEL,
    start: '09:00',
    end: { time: '09:40' },
    details: line('2', '#00A84D'),
  },
  {
    day: 3,
    kind: 'place',
    title: 'Starfield Library, COEX',
    tz: SEL,
    start: '10:00',
    end: { time: '12:00' },
  },
  { day: 3, kind: 'place', title: 'Hongdae', tz: SEL, start: '14:00', end: { time: '17:00' } },
  {
    day: 3,
    kind: 'place',
    title: 'Korean BBQ dinner',
    tz: SEL,
    start: '18:30',
    end: { time: '20:00' },
  },
  { day: 3, kind: 'sleep', title: 'Sleep', tz: SEL, start: '23:30' },
  // Day 4: fly home
  { day: 4, kind: 'wake', title: 'Wake up', tz: SEL, start: '08:00' },
  { day: 4, kind: 'task', title: 'Check out', tz: SEL, start: '10:00', end: { time: '11:00' } },
  {
    day: 4,
    kind: 'place',
    title: 'Souvenir shopping',
    tz: SEL,
    start: '11:30',
    end: { time: '14:00' },
  },
  {
    day: 4,
    kind: 'move',
    title: 'AREX to Incheon Airport',
    tz: SEL,
    start: '14:30',
    end: { time: '15:40' },
    details: line('AREX', '#0090D2'),
  },
  {
    day: 4,
    kind: 'place',
    title: 'Airport lounge',
    tz: SEL,
    start: '17:40',
    end: { time: '19:00' },
  },
  {
    day: 4,
    kind: 'flight',
    title: 'Flight ICN → BKK',
    tz: SEL,
    start: '19:50',
    end: { time: '00:10', dayOffset: 1, tz: BKK },
    details: { flightNumber: 'DM 102', from: 'ICN', to: 'BKK', arrivalTimeZone: BKK },
  },
  // Day 5: home
  { day: 5, kind: 'move', title: 'Taxi home', tz: BKK, start: '00:40', end: { time: '01:40' } },
  { day: 5, kind: 'sleep', title: 'Sleep', tz: BKK, start: '02:00' },
]

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10)
}

export interface DemoItem {
  dayDate: string
  kind: Kind
  title: string
  startsAt: Date
  endsAt: Date | null
  timeZone: string
  notes: string | null
  details: Record<string, unknown>
  sortOrder: number
}

export interface DemoTrip {
  trip: {
    id: string
    name: string
    destination: string
    startDate: string
    endDate: string
    homeTimeZone: string
    baseCurrency: string
  }
  items: DemoItem[]
}

/**
 * The trip starts the day before `today` (a prep day at home) so that
 * `today` is the arrival day in Seoul.
 */
export function buildDemoTrip(today: string): DemoTrip {
  const start = addDays(today, -1)
  const days = Math.max(...ITINERARY.map((i) => i.day))
  const items = ITINERARY.map((spec, index): DemoItem => {
    const dayDate = addDays(start, spec.day)
    const startDate = spec.startsNextDay ? addDays(dayDate, 1) : dayDate
    const startsAt = fromLocalInput(`${startDate}T${spec.start}`, spec.tz)
    let endsAt: Date | null = null
    if (spec.end) {
      const endDate = addDays(startDate, spec.end.dayOffset ?? 0)
      endsAt = fromLocalInput(`${endDate}T${spec.end.time}`, spec.end.tz ?? spec.tz)
    }
    return {
      dayDate,
      kind: spec.kind,
      title: spec.title,
      startsAt,
      endsAt,
      timeZone: spec.tz,
      notes: spec.notes ?? null,
      details: spec.details ?? {},
      sortOrder: index,
    }
  })
  return {
    trip: {
      id: DEMO_TRIP_ID,
      name: 'Seoul (demo)',
      destination: 'Seoul, South Korea',
      startDate: start,
      endDate: addDays(start, days),
      homeTimeZone: BKK,
      baseCurrency: 'THB',
    },
    items,
  }
}

/** Fictional checklist grouped like the prototype's. */
export const DEMO_CHECKLIST: { groupKey: string; title: string; ticked?: boolean }[] = [
  { groupKey: 'documents', title: 'Passports (6+ months valid)', ticked: true },
  { groupKey: 'documents', title: 'K-ETA approval printout', ticked: true },
  { groupKey: 'documents', title: 'Travel insurance policy' },
  { groupKey: 'bookings', title: 'Flight e-tickets in wallet', ticked: true },
  { groupKey: 'bookings', title: 'Hotel confirmation' },
  { groupKey: 'money', title: 'KRW cash for markets' },
  { groupKey: 'money', title: 'T-money card topped up' },
  { groupKey: 'money', title: 'eSIM installed' },
  { groupKey: 'packing', title: 'Power adapter (type C/F)' },
  { groupKey: 'packing', title: 'Power bank under 100 Wh (carry-on)' },
  { groupKey: 'clothes', title: 'Light jacket for evenings' },
  { groupKey: 'airport', title: 'Online check-in done' },
  { groupKey: 'airport', title: 'Liquids under 100 ml in a clear bag' },
  { groupKey: 'return', title: 'Tax refund receipts' },
]

export const DEMO_INFO_CARDS: {
  kind: 'flight' | 'hotel' | 'health' | 'lounge' | 'emergency' | 'tip' | 'other'
  title: string
  body: string
}[] = [
  {
    kind: 'flight',
    title: 'Flights',
    body: 'DM 101 BKK → ICN, departs 02:25 (Bangkok), arrives 10:00 (Seoul)\nDM 102 ICN → BKK, departs 19:50 (Seoul), arrives 00:10 (Bangkok)\nBooking ref: DEMO01',
  },
  {
    kind: 'hotel',
    title: 'Hotel',
    body: 'Demo Hotel Sinchon\nSinchon, Seodaemun-gu, Seoul\nCheck-in 15:00 · Check-out 11:00',
  },
  {
    kind: 'emergency',
    title: 'Emergency numbers (Korea)',
    body: 'Police 112\nFire & ambulance 119\nTourist helpline 1330 (English, Thai)',
  },
  {
    kind: 'tip',
    title: 'Getting around',
    body: 'Tap the T-money card when you get on AND off buses.\nSubway lines are colour-coded; follow the line number.',
  },
]
