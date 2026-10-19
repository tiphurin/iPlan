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

export const DEMO_FX_RATES = { KRW: '0.0255' }
/** 3,000 THB per day, in satang. */
export const DEMO_DAILY_BUDGET_MINOR = 300000n

/** Fictional spending; `day` is the trip day index, amounts in major units. */
export const DEMO_EXPENSES: {
  day: number
  title: string
  category: 'food' | 'transport' | 'shopping' | 'stay' | 'activity' | 'health' | 'other'
  amount: string
  currency: 'THB' | 'KRW'
  paidBy: 'owner' | 'friend' | 'pool'
  split: 'equal' | { owner: string; friend: string }
}[] = [
  {
    day: 0,
    title: 'Taxi to the airport',
    category: 'transport',
    amount: '450',
    currency: 'THB',
    paidBy: 'owner',
    split: 'equal',
  },
  {
    day: 0,
    title: 'KRW cash exchange fee',
    category: 'other',
    amount: '120',
    currency: 'THB',
    paidBy: 'friend',
    split: 'equal',
  },
  {
    day: 1,
    title: 'AREX tickets',
    category: 'transport',
    amount: '19000',
    currency: 'KRW',
    paidBy: 'pool',
    split: 'equal',
  },
  {
    day: 1,
    title: 'Dakgalbi lunch',
    category: 'food',
    amount: '32000',
    currency: 'KRW',
    paidBy: 'owner',
    split: 'equal',
  },
  {
    day: 1,
    title: 'Palace entry + hanbok',
    category: 'activity',
    amount: '60000',
    currency: 'KRW',
    paidBy: 'friend',
    split: { owner: '40000', friend: '20000' },
  },
  {
    day: 1,
    title: 'Gwangjang Market dinner',
    category: 'food',
    amount: '41000',
    currency: 'KRW',
    paidBy: 'owner',
    split: 'equal',
  },
  {
    day: 2,
    title: 'Myeongdong cosmetics',
    category: 'shopping',
    amount: '88000',
    currency: 'KRW',
    paidBy: 'friend',
    split: { owner: '0', friend: '88000' },
  },
]

/** Same keys and colours as the API's built-in categories. */
export const DEMO_FINANCE_CATEGORIES = [
  { kind: 'income', key: 'salary', color: '#16a34a' },
  { kind: 'income', key: 'bonus', color: '#0d9488' },
  { kind: 'income', key: 'other-income', color: '#64748b' },
  { kind: 'expense', key: 'food', color: '#f97316', budget: 800000n },
  { kind: 'expense', key: 'transport', color: '#0ea5e9', budget: 300000n },
  { kind: 'expense', key: 'bills', color: '#eab308' },
  { kind: 'expense', key: 'home', color: '#8b5cf6' },
  { kind: 'expense', key: 'shopping', color: '#ec4899', budget: 500000n },
  { kind: 'expense', key: 'health', color: '#ef4444' },
  { kind: 'expense', key: 'fun', color: '#22c55e' },
  { kind: 'expense', key: 'other', color: '#94a3b8' },
] as const

/** Fictional payslip and fixed costs (baht). `from` is months before this month. */
export const DEMO_RULES = [
  { kind: 'income', name: 'Salary', amount: '45000', from: 12, category: 'salary' },
  { kind: 'deduction', name: 'Withholding tax', amount: '1850', from: 12 },
  { kind: 'deduction', name: 'Social security', amount: '750', from: 12 },
  { kind: 'deduction', name: 'Provident fund 5%', amount: '2250', from: 12 },
  { kind: 'fixed', name: 'Condo installment', amount: '9800', from: 12, category: 'home' },
  { kind: 'fixed', name: 'Mobile plan', amount: '599', from: 12, category: 'bills' },
  { kind: 'fixed', name: 'Internet', amount: '649', from: 12, category: 'bills' },
  { kind: 'fixed', name: 'Gym membership', amount: '1200', from: 12, category: 'fun' },
] as const

/** One-off spending per month back; `ago` 0 = this month. */
export const DEMO_TRANSACTIONS: {
  ago: number
  day: number
  kind: 'income' | 'expense'
  title: string
  amount: string
  category: string
}[] = [
  { ago: 0, day: 2, kind: 'expense', title: 'Groceries', amount: '1850', category: 'food' },
  {
    ago: 0,
    day: 5,
    kind: 'expense',
    title: 'Dinner with friends',
    amount: '1240',
    category: 'food',
  },
  { ago: 0, day: 8, kind: 'expense', title: 'BTS top-up', amount: '500', category: 'transport' },
  {
    ago: 0,
    day: 10,
    kind: 'expense',
    title: 'New running shoes',
    amount: '3290',
    category: 'shopping',
  },
  {
    ago: 0,
    day: 12,
    kind: 'income',
    title: 'Sold old camera',
    amount: '4500',
    category: 'other-income',
  },
  { ago: 1, day: 3, kind: 'expense', title: 'Groceries', amount: '2100', category: 'food' },
  { ago: 1, day: 14, kind: 'expense', title: 'Dentist', amount: '1500', category: 'health' },
  { ago: 1, day: 20, kind: 'expense', title: 'Concert ticket', amount: '2800', category: 'fun' },
  { ago: 1, day: 25, kind: 'expense', title: 'Taxi', amount: '420', category: 'transport' },
  { ago: 2, day: 6, kind: 'expense', title: 'Groceries', amount: '1950', category: 'food' },
  { ago: 2, day: 18, kind: 'expense', title: 'Phone case', amount: '590', category: 'shopping' },
  { ago: 3, day: 9, kind: 'expense', title: 'Groceries', amount: '2300', category: 'food' },
  { ago: 3, day: 21, kind: 'expense', title: 'Weekend trip', amount: '6400', category: 'fun' },
  { ago: 4, day: 4, kind: 'expense', title: 'Groceries', amount: '1780', category: 'food' },
  { ago: 5, day: 11, kind: 'expense', title: 'Groceries', amount: '2050', category: 'food' },
  { ago: 5, day: 27, kind: 'expense', title: 'Air purifier', amount: '4990', category: 'home' },
]

export function addMonthsKey(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}
