import type {
  CheckInInput,
  CreateTripItemInput,
  TripItemDto,
  UpdateTripItemInput,
} from '@iplan/contracts'
import { isValidTimeZone } from '@iplan/core'
import type { AuditLog } from '../../shared/audit'
import type { SessionUser } from '../../shared/context'
import { notFound, validationFailed } from '../../shared/errors'
import type { TripRow } from '../trips/trips.repository'
import type { TripAccess } from '../trips/trips.service'
import { toItemDto } from './items.mapper'
import type { ItemRow, ItemsRepository, NewItemRow } from './items.repository'

/** Furthest a check-in may be from now (the time simulator stays within the trip). */
const MAX_CHECK_IN_SKEW_MS = 45 * 86_400_000

function checkItem(
  trip: TripRow,
  item: Pick<NewItemRow, 'dayDate' | 'startsAt' | 'endsAt' | 'timeZone' | 'details'>,
) {
  const problems: Record<string, string> = {}
  if (item.dayDate < trip.startDate || item.dayDate > trip.endDate) {
    problems.dayDate = 'Day must be within the trip dates'
  }
  if (!isValidTimeZone(item.timeZone)) problems.timeZone = 'Unknown time zone'
  if (item.endsAt && item.endsAt.getTime() <= item.startsAt.getTime()) {
    problems.endsAt = 'End must be after start'
  }
  const arrival = (item.details as { arrivalTimeZone?: unknown } | undefined)?.arrivalTimeZone
  if (typeof arrival === 'string' && !isValidTimeZone(arrival)) {
    problems['details.arrivalTimeZone'] = 'Unknown time zone'
  }
  if (Object.keys(problems).length > 0) throw validationFailed(problems)
}

export class ItemsService {
  constructor(
    private readonly items: ItemsRepository,
    private readonly trips: TripAccess,
    private readonly audit: AuditLog,
  ) {}

  private async dto(row: ItemRow): Promise<TripItemDto> {
    return toItemDto(row, await this.items.checkInsByItem(row.id))
  }

  /** Loads an item and checks the actor's role in its trip. */
  private async load(actor: SessionUser, itemId: string, minimum: 'viewer' | 'editor') {
    const item = await this.items.findById(itemId)
    if (!item) throw notFound('Item')
    const { trip } = await this.trips.requireAccess(actor, item.tripId, minimum)
    return { item, trip }
  }

  async list(actor: SessionUser, tripId: string): Promise<TripItemDto[]> {
    await this.trips.requireAccess(actor, tripId, 'viewer')
    const [rows, checkIns] = await Promise.all([
      this.items.listByTrip(tripId),
      this.items.checkInsByTrip(tripId),
    ])
    return rows.map((row) => toItemDto(row, checkIns))
  }

  async create(
    actor: SessionUser,
    tripId: string,
    input: CreateTripItemInput,
  ): Promise<TripItemDto> {
    const { trip } = await this.trips.requireAccess(actor, tripId, 'editor')
    const values: NewItemRow = {
      tripId,
      dayDate: input.dayDate,
      kind: input.kind,
      title: input.title,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      timeZone: input.timeZone,
      notes: input.notes ?? null,
      details: input.details ?? {},
      sortOrder: await this.items.nextSortOrder(tripId, input.dayDate),
    }
    checkItem(trip, values)
    const row = await this.items.create(values)
    await this.audit.record({
      actorId: actor.id,
      action: 'item.create',
      entityType: 'trip_item',
      entityId: row.id,
      data: { tripId, title: row.title },
    })
    return this.dto(row)
  }

  async update(
    actor: SessionUser,
    itemId: string,
    input: UpdateTripItemInput,
  ): Promise<TripItemDto> {
    const { item, trip } = await this.load(actor, itemId, 'editor')
    const changes: Partial<NewItemRow> = {}
    if (input.dayDate !== undefined) changes.dayDate = input.dayDate
    if (input.kind !== undefined) changes.kind = input.kind
    if (input.title !== undefined) changes.title = input.title
    if (input.startsAt !== undefined) changes.startsAt = new Date(input.startsAt)
    if (input.endsAt !== undefined) changes.endsAt = input.endsAt ? new Date(input.endsAt) : null
    if (input.timeZone !== undefined) changes.timeZone = input.timeZone
    if (input.notes !== undefined) changes.notes = input.notes
    if (input.details !== undefined) changes.details = input.details
    checkItem(trip, {
      dayDate: changes.dayDate ?? item.dayDate,
      startsAt: changes.startsAt ?? item.startsAt,
      endsAt: changes.endsAt !== undefined ? changes.endsAt : item.endsAt,
      timeZone: changes.timeZone ?? item.timeZone,
      details: changes.details ?? item.details,
    })
    const row = Object.keys(changes).length > 0 ? await this.items.update(itemId, changes) : item
    if (!row) throw notFound('Item')
    await this.audit.record({
      actorId: actor.id,
      action: 'item.update',
      entityType: 'trip_item',
      entityId: itemId,
      data: { fields: Object.keys(changes) },
    })
    return this.dto(row)
  }

  async duplicate(actor: SessionUser, itemId: string): Promise<TripItemDto> {
    const { item } = await this.load(actor, itemId, 'editor')
    const row = await this.items.create({
      tripId: item.tripId,
      dayDate: item.dayDate,
      kind: item.kind,
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      timeZone: item.timeZone,
      notes: item.notes,
      details: item.details,
      sortOrder: await this.items.nextSortOrder(item.tripId, item.dayDate),
    })
    await this.audit.record({
      actorId: actor.id,
      action: 'item.duplicate',
      entityType: 'trip_item',
      entityId: row.id,
      data: { from: itemId },
    })
    return this.dto(row)
  }

  async remove(actor: SessionUser, itemId: string): Promise<void> {
    const { item } = await this.load(actor, itemId, 'editor')
    await this.items.delete(itemId)
    await this.audit.record({
      actorId: actor.id,
      action: 'item.delete',
      entityType: 'trip_item',
      entityId: itemId,
      data: { tripId: item.tripId, title: item.title },
    })
  }

  /** Any member (viewers too) can check themselves in. */
  async checkIn(
    actor: SessionUser,
    itemId: string,
    input: CheckInInput,
    now = new Date(),
  ): Promise<TripItemDto> {
    const { item } = await this.load(actor, itemId, 'viewer')
    const at = input.at ? new Date(input.at) : now
    if (Math.abs(at.getTime() - now.getTime()) > MAX_CHECK_IN_SKEW_MS) {
      throw validationFailed({ at: 'Check-in time is too far from now' })
    }
    await this.items.upsertCheckIn(itemId, actor.id, at)
    return this.dto(item)
  }

  async undoCheckIn(actor: SessionUser, itemId: string): Promise<TripItemDto> {
    const { item } = await this.load(actor, itemId, 'viewer')
    await this.items.deleteCheckIn(itemId, actor.id)
    return this.dto(item)
  }
}
