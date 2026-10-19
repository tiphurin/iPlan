import {
  type CreateTripInput,
  MAX_ATTACHMENT_BYTES,
  type TripDetailDto,
  type TripDto,
  type TripRole,
  type UpdateTripInput,
} from '@iplan/contracts'
import { isValidTimeZone } from '@iplan/core'
import { randomUUID } from 'node:crypto'
import type { StorageProvider } from '../../infra/storage'
import type { AuditLog } from '../../shared/audit'
import { type SessionUser, isAdmin, isSuperAdmin } from '../../shared/context'
import { AppError, forbidden, notFound, validationFailed } from '../../shared/errors'
import { sniffType } from '../../shared/file-type'
import { toTripDetailDto, toTripDto } from './trips.mapper'
import type { NewTripRow, TripWithRole, TripsRepository } from './trips.repository'

export const RANK: Record<TripRole, number> = { viewer: 0, editor: 1, owner: 2 }
export const MAX_TRIP_DAYS = 60
/** The browser shrinks covers to 1600 px WebP first, so real uploads are far below this. */
export const MAX_COVER_BYTES = MAX_ATTACHMENT_BYTES
const COVER_EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

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
    private readonly storage?: StorageProvider,
  ) {}

  private requireStorage(): StorageProvider {
    if (!this.storage) throw new Error('Storage is not configured')
    return this.storage
  }

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
      color: input.color ?? null,
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
    if (input.color !== undefined) changes.color = input.color
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

  /**
   * Replaces the cover photo (editor or owner); the old file is deleted afterwards.
   * The type comes from the bytes themselves, never from what the browser declared.
   */
  async setCover(actor: SessionUser, tripId: string, bytes: Uint8Array): Promise<TripDetailDto> {
    const { trip } = await this.requireAccess(actor, tripId, 'editor')
    const storage = this.requireStorage()
    if (bytes.byteLength > MAX_COVER_BYTES) {
      throw validationFailed({ file: 'File is larger than 5 MB' })
    }
    const contentType = sniffType(bytes)
    const ext = contentType ? COVER_EXT[contentType] : undefined
    if (!contentType || !ext) throw validationFailed({ file: 'Use a JPEG, PNG or WebP image' })
    const key = `trips/${tripId}/cover-${randomUUID()}.${ext}`
    await storage.put(key, bytes, contentType)
    await this.trips.update(tripId, { coverKey: key })
    if (trip.coverKey) await storage.delete(trip.coverKey).catch(() => undefined)
    await this.audit.record({
      actorId: actor.id,
      action: 'trip.cover.set',
      entityType: 'trip',
      entityId: tripId,
      data: { bytes: bytes.byteLength },
    })
    return this.get(actor, tripId)
  }

  /** Back to the colour cover. */
  async removeCover(actor: SessionUser, tripId: string): Promise<TripDetailDto> {
    const { trip } = await this.requireAccess(actor, tripId, 'editor')
    if (trip.coverKey) {
      await this.trips.update(tripId, { coverKey: null })
      await this.requireStorage()
        .delete(trip.coverKey)
        .catch(() => undefined)
      await this.audit.record({
        actorId: actor.id,
        action: 'trip.cover.remove',
        entityType: 'trip',
        entityId: tripId,
      })
    }
    return this.get(actor, tripId)
  }

  /** Storage key and type of the cover photo, after checking the viewer can see the trip. */
  async coverFile(
    actor: SessionUser,
    tripId: string,
  ): Promise<{ key: string; contentType: string } | null> {
    const { trip } = await this.requireAccess(actor, tripId, 'viewer')
    if (!trip.coverKey) return null
    const ext = trip.coverKey.split('.').pop() ?? ''
    const contentType =
      Object.entries(COVER_EXT).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream'
    return { key: trip.coverKey, contentType }
  }

  async remove(actor: SessionUser, tripId: string): Promise<void> {
    const { trip } = await this.requireAccess(actor, tripId, 'owner')
    await this.trips.delete(tripId)
    if (trip.coverKey && this.storage)
      await this.storage.delete(trip.coverKey).catch(() => undefined)
    await this.audit.record({
      actorId: actor.id,
      action: 'trip.delete',
      entityType: 'trip',
      entityId: tripId,
      data: { name: trip.name },
    })
  }
}
