import type {
  CreateTripInput,
  TripDetailDto,
  TripDto,
  TripRole,
  UpdateTripInput,
} from '@iplan/contracts'
import { isValidTimeZone } from '@iplan/core'
import type { AuditLog } from '../../shared/audit'
import { type SessionUser, isAdmin, isSuperAdmin } from '../../shared/context'
import { AppError, forbidden, notFound, validationFailed } from '../../shared/errors'
import { toTripDetailDto, toTripDto } from './trips.mapper'
import type { NewTripRow, TripWithRole, TripsRepository } from './trips.repository'

export const RANK: Record<TripRole, number> = { viewer: 0, editor: 1, owner: 2 }
export const MAX_TRIP_DAYS = 60

/** Lets other modules (items, expenses...) check trip permissions. */
export interface TripAccess {
  requireAccess(actor: SessionUser, tripId: string, minimum: TripRole): Promise<TripWithRole>
}

function daysBetween(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000
}

export function checkTripFields(
  fields: Pick<NewTripRow, 'startDate' | 'endDate' | 'homeTimeZone'>,
) {
  const problems: Record<string, string> = {}
  const span = daysBetween(fields.startDate, fields.endDate)
  if (span < 0) problems.endDate = 'End date must be on or after the start date'
  else if (span >= MAX_TRIP_DAYS) problems.endDate = `A trip can last at most ${MAX_TRIP_DAYS} days`
  if (fields.homeTimeZone !== undefined && !isValidTimeZone(fields.homeTimeZone)) {
    problems.homeTimeZone = 'Unknown time zone'
  }
  if (Object.keys(problems).length > 0) throw validationFailed(problems)
}

export class TripsService implements TripAccess {
  constructor(
    private readonly trips: TripsRepository,
    private readonly audit: AuditLog,
  ) {}

  async requireAccess(actor: SessionUser, tripId: string, minimum: TripRole) {
    // Admins can look at any trip; only the superadmin can also change it.
    const found =
      (await this.trips.findForUser(tripId, actor.id)) ??
      (isAdmin(actor)
        ? await this.trips.findAny(tripId, isSuperAdmin(actor) ? 'owner' : 'viewer')
        : null)
    // Non-members get "not found" so trip ids can't be probed.
    if (!found) throw notFound('Trip')
    if (RANK[found.role] < RANK[minimum]) throw forbidden(`Requires ${minimum} role`)
    return found
  }

  async list(actor: SessionUser): Promise<TripDto[]> {
    return (await this.trips.listForUser(actor.id)).map(toTripDto)
  }

  async get(actor: SessionUser, tripId: string): Promise<TripDetailDto> {
    const found = await this.requireAccess(actor, tripId, 'viewer')
    if (isAdmin(actor) && !(await this.trips.findForUser(tripId, actor.id))) {
      await this.audit.record({
        actorId: actor.id,
        action: 'admin.view',
        entityType: 'trip',
        entityId: tripId,
      })
    }
    return toTripDetailDto(found, await this.trips.members(tripId))
  }

  async create(actor: SessionUser, input: CreateTripInput): Promise<TripDetailDto> {
    const values: NewTripRow = {
      name: input.name,
      destination: input.destination ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      homeTimeZone: input.homeTimeZone,
      baseCurrency: input.baseCurrency,
      createdBy: actor.id,
    }
    checkTripFields(values)
    const trip = await this.trips.create(values, actor.id)
    await this.audit.record({
      actorId: actor.id,
      action: 'trip.create',
      entityType: 'trip',
      entityId: trip.id,
      data: { name: trip.name },
    })
    return this.get(actor, trip.id)
  }

  async update(actor: SessionUser, tripId: string, input: UpdateTripInput): Promise<TripDetailDto> {
    const { trip } = await this.requireAccess(actor, tripId, 'editor')
    const changes: Partial<NewTripRow> = {}
    if (input.name !== undefined) changes.name = input.name
    if (input.destination !== undefined) changes.destination = input.destination
    if (input.startDate !== undefined) changes.startDate = input.startDate
    if (input.endDate !== undefined) changes.endDate = input.endDate
    if (input.homeTimeZone !== undefined) changes.homeTimeZone = input.homeTimeZone
    if (input.baseCurrency !== undefined && input.baseCurrency !== trip.baseCurrency) {
      changes.baseCurrency = input.baseCurrency
    }
    const startDate = changes.startDate ?? trip.startDate
    const endDate = changes.endDate ?? trip.endDate
    checkTripFields({
      startDate,
      endDate,
      homeTimeZone: changes.homeTimeZone ?? trip.homeTimeZone,
    })
    if (
      changes.baseCurrency !== undefined ||
      changes.startDate !== undefined ||
      changes.endDate !== undefined
    ) {
      const contents = await this.trips.contents(tripId)
      // Expenses keep amounts converted into the trip currency; changing it would make them wrong.
      if (changes.baseCurrency !== undefined) {
        if (contents.expenseCount > 0) {
          throw new AppError(
            'TRIP_CURRENCY_LOCKED',
            409,
            'The trip currency cannot change once expenses exist',
          )
        }
        // Saved rates and the daily budget are in the old currency, so they no longer apply.
        changes.fxRates = {}
        changes.dailyBudgetMinor = null
      }
      // Plans and expenses outside the new dates would disappear from every view.
      if (
        (contents.firstDay !== null && contents.firstDay < startDate) ||
        (contents.lastDay !== null && contents.lastDay > endDate)
      ) {
        throw new AppError(
          'TRIP_DATES_EXCLUDE_CONTENT',
          409,
          `Plans or expenses exist from ${contents.firstDay} to ${contents.lastDay}`,
        )
      }
    }
    if (Object.keys(changes).length > 0) {
      await this.trips.update(tripId, changes)
      await this.audit.record({
        actorId: actor.id,
        action: 'trip.update',
        entityType: 'trip',
        entityId: tripId,
        data: { fields: Object.keys(changes) },
      })
    }
    return this.get(actor, tripId)
  }

  async remove(actor: SessionUser, tripId: string): Promise<void> {
    const { trip } = await this.requireAccess(actor, tripId, 'owner')
    await this.trips.delete(tripId)
    await this.audit.record({
      actorId: actor.id,
      action: 'trip.delete',
      entityType: 'trip',
      entityId: tripId,
      data: { name: trip.name },
    })
  }
}
