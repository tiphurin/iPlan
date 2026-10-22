import { z } from 'zod'

const DateKey = z.iso.date()
const Instant = z.iso.datetime({ offset: true })
const CurrencyCode = z.string().regex(/^[A-Z]{3}$/)
const Currency = CurrencyCode.default('THB')
/** Links open in the browser, so only web addresses (no javascript: or data:). */
export const WebUrl = z.url({ protocol: /^https?$/ })

/** Suggested cover colours: calm tones that keep white text readable in light and dark mode. */
export const TRIP_COLORS = [
  '#00a84d',
  '#0e7490',
  '#0090d2',
  '#0052a4',
  '#6366f1',
  '#996cac',
  '#d6453d',
  '#475569',
] as const
/** Any cover colour as #rrggbb (the palette above or one picked freely), stored lower-case. */
export const TripColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((c) => c.toLowerCase())
export type TripColor = z.infer<typeof TripColor>

export function isTripColor(value: unknown): value is TripColor {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

export const TripRole = z.enum(['owner', 'editor', 'viewer'])
export type TripRole = z.infer<typeof TripRole>

export const TripDto = z.object({
  id: z.uuid(),
  name: z.string(),
  destination: z.string().nullable(),
  startDate: DateKey,
  endDate: DateKey,
  homeTimeZone: z.string(),
  baseCurrency: z.string(),
  /** Base-currency units per 1 unit of each currency: { KRW: "0.0255" }. */
  fxRates: z.record(z.string(), z.string()),
  /** Planned spending per day in base minor units. */
  dailyBudgetMinor: z.string().nullable(),
  /** Chosen cover colour; null means one is picked from the trip id. */
  color: z.string().nullable(),
  /** Cover photo served by the API (versioned for caching); null shows the colour. */
  coverUrl: z.string().nullable(),
  /** The caller's role in this trip. */
  role: TripRole,
  memberCount: z.number().int(),
})
export type TripDto = z.infer<typeof TripDto>

export const TripMemberDto = z.object({
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  role: TripRole,
})
export type TripMemberDto = z.infer<typeof TripMemberDto>

export const TripDetailDto = TripDto.extend({ members: z.array(TripMemberDto) })
export type TripDetailDto = z.infer<typeof TripDetailDto>

const tripFields = {
  name: z.string().trim().min(1).max(80),
  destination: z.string().trim().max(120).nullable().optional(),
  startDate: DateKey,
  endDate: DateKey,
  homeTimeZone: z.string().min(1).default('Asia/Bangkok'),
  baseCurrency: Currency,
  /** Cover colour (#rrggbb); null clears it. */
  color: TripColor.nullable().optional(),
}

export const CreateTripInput = z.object(tripFields)
export type CreateTripInput = z.infer<typeof CreateTripInput>

/** No defaults here: a field left out of an update keeps its stored value. */
export const UpdateTripInput = z
  .object({ ...tripFields, homeTimeZone: z.string().min(1), baseCurrency: CurrencyCode })
  .partial()
export type UpdateTripInput = z.infer<typeof UpdateTripInput>

export const TripItemKind = z.enum(['place', 'move', 'flight', 'task', 'wake', 'sleep'])
export type TripItemKind = z.infer<typeof TripItemKind>

/** Kind-specific extras. Unknown keys are kept so older clients don't drop data. */
export const TripItemDetails = z
  .object({
    address: z.string().max(300).optional(),
    /** Coordinates from the place search; calendars show a map pin with them. */
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    phone: z.string().max(40).optional(),
    url: WebUrl.optional(),
    hours: z.string().max(80).optional(),
    line: z.string().max(20).optional(),
    /** More rail lines on the same ride after `line` (a transfer, e.g. Purple then Blue). */
    via: z.array(z.string().trim().min(1).max(20)).max(6).optional(),
    lineColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    flightNumber: z.string().max(12).optional(),
    /** Flight: airport codes. Move: start and end station. */
    from: z.string().max(80).optional(),
    to: z.string().max(80).optional(),
    terminal: z.string().max(40).optional(),
    arrivalTimeZone: z.string().optional(),
    budget: z.object({ amount: z.string(), currency: z.string() }).optional(),
    /** Can't be moved (an appointment, a booked slot). */
    fixed: z.boolean().optional(),
    /** Opening hours or booking still to check. */
    verify: z.boolean().optional(),
    optional: z.boolean().optional(),
  })
  .loose()
export type TripItemDetails = z.infer<typeof TripItemDetails>

export const CheckInDto = z.object({
  userId: z.string(),
  name: z.string(),
  checkedInAt: Instant,
  skipped: z.boolean(),
})
export type CheckInDto = z.infer<typeof CheckInDto>

export const TripItemDto = z.object({
  id: z.uuid(),
  tripId: z.uuid(),
  dayDate: DateKey,
  kind: TripItemKind,
  title: z.string(),
  startsAt: Instant,
  endsAt: Instant.nullable(),
  timeZone: z.string(),
  notes: z.string().nullable(),
  details: TripItemDetails,
  sortOrder: z.number().int(),
  checkIns: z.array(CheckInDto),
})
export type TripItemDto = z.infer<typeof TripItemDto>

const itemFields = {
  dayDate: DateKey,
  kind: TripItemKind,
  title: z.string().trim().min(1).max(120),
  startsAt: Instant,
  endsAt: Instant.nullable().optional(),
  timeZone: z.string().min(1),
  notes: z.string().trim().max(2000).nullable().optional(),
  details: TripItemDetails.optional(),
}

export const CreateTripItemInput = z.object(itemFields)
export type CreateTripItemInput = z.infer<typeof CreateTripItemInput>

export const UpdateTripItemInput = z.object(itemFields).partial()

/**
 * Move several plan items by the same amount of time at once (e.g. the ones
 * after an item that now ends later). All or nothing.
 */
export const ShiftItemsInput = z.object({
  itemIds: z.array(z.uuid()).min(1).max(100),
  /** Minutes to move by; negative moves earlier. Up to a day either way. */
  minutes: z
    .number()
    .int()
    .min(-1440)
    .max(1440)
    .refine((m) => m !== 0, 'Must move by at least a minute'),
})
export type ShiftItemsInput = z.infer<typeof ShiftItemsInput>
export type UpdateTripItemInput = z.infer<typeof UpdateTripItemInput>

export const CheckInInput = z.object({
  /** Defaults to now; the time simulator sends its own time. */
  at: Instant.optional(),
  /** Mark the item as skipped instead of done. */
  skipped: z.boolean().optional(),
})
export type CheckInInput = z.infer<typeof CheckInInput>

/** Links for subscribing to a trip in a calendar app (kept up to date automatically). */
export const CalendarFeedDto = z.object({
  /** https link, for "subscribe by URL" in any calendar. */
  url: z.string(),
  /** Opens the iPhone/Mac Calendar subscribe dialog. */
  webcalUrl: z.string(),
  /** Opens Google Calendar's "add calendar from URL". */
  googleUrl: z.string(),
})
export type CalendarFeedDto = z.infer<typeof CalendarFeedDto>

/** One suggestion from the free place search (OpenStreetMap data via Photon). */
export const PlaceDto = z.object({
  name: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
})
export type PlaceDto = z.infer<typeof PlaceDto>

export const PlaceQuery = z.object({
  q: z.string().trim().min(2).max(120),
  /** Bias results near this point, e.g. the trip's other places. */
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  /** Only railway/subway stations, or only airports (start and end of a ride or flight). */
  kind: z.enum(['station', 'airport']).optional(),
})
