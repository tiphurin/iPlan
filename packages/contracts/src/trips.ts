import { z } from 'zod'

const DateKey = z.iso.date()
const Instant = z.iso.datetime({ offset: true })
const Currency = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .default('THB')

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
}

export const CreateTripInput = z.object(tripFields)
export type CreateTripInput = z.infer<typeof CreateTripInput>

export const UpdateTripInput = z.object(tripFields).partial()
export type UpdateTripInput = z.infer<typeof UpdateTripInput>

export const TripItemKind = z.enum(['place', 'move', 'flight', 'task', 'wake', 'sleep'])
export type TripItemKind = z.infer<typeof TripItemKind>

/** Kind-specific extras. Unknown keys are kept so older clients don't drop data. */
export const TripItemDetails = z
  .object({
    address: z.string().max(300).optional(),
    phone: z.string().max(40).optional(),
    url: z.url().optional(),
    hours: z.string().max(80).optional(),
    line: z.string().max(20).optional(),
    lineColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    flightNumber: z.string().max(12).optional(),
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
    terminal: z.string().max(40).optional(),
    arrivalTimeZone: z.string().optional(),
    budget: z.object({ amount: z.string(), currency: z.string() }).optional(),
  })
  .loose()
export type TripItemDetails = z.infer<typeof TripItemDetails>

export const CheckInDto = z.object({
  userId: z.string(),
  name: z.string(),
  checkedInAt: Instant,
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
export type UpdateTripItemInput = z.infer<typeof UpdateTripItemInput>

export const CheckInInput = z.object({
  /** Defaults to now; the time simulator sends its own time. */
  at: Instant.optional(),
})
export type CheckInInput = z.infer<typeof CheckInInput>
