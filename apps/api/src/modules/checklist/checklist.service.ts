import type {
  ChecklistItemDto,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
} from '@iplan/contracts'
import type { AuditLog } from '../../shared/audit'
import type { SessionUser } from '../../shared/context'
import { notFound } from '../../shared/errors'
import type { TripAccess } from '../trips/trips.service'
import { toChecklistItemDto } from './checklist.mapper'
import type { ChecklistRepository } from './checklist.repository'

export class ChecklistService {
  constructor(
    private readonly checklist: ChecklistRepository,
    private readonly trips: TripAccess,
    private readonly audit: AuditLog,
  ) {}

  private async load(actor: SessionUser, itemId: string, minimum: 'viewer' | 'editor') {
    const item = await this.checklist.find(itemId)
    if (!item) throw notFound('Checklist item')
    await this.trips.requireAccess(actor, item.tripId, minimum)
    return item
  }

  async list(actor: SessionUser, tripId: string): Promise<ChecklistItemDto[]> {
    await this.trips.requireAccess(actor, tripId, 'viewer')
    const [rows, ticks] = await Promise.all([
      this.checklist.list(tripId),
      this.checklist.ticks(tripId),
    ])
    return rows.map((row) => toChecklistItemDto(row, ticks))
  }

  async create(actor: SessionUser, tripId: string, input: CreateChecklistItemInput) {
    await this.trips.requireAccess(actor, tripId, 'editor')
    const row = await this.checklist.create({
      tripId,
      groupKey: input.groupKey,
      title: input.title,
      sortOrder: await this.checklist.nextSortOrder(tripId, input.groupKey),
    })
    await this.audit.record({
      actorId: actor.id,
      action: 'checklist.create',
      entityType: 'checklist_item',
      entityId: row.id,
      data: { tripId, title: row.title },
    })
    return toChecklistItemDto(row, [])
  }

  async update(actor: SessionUser, itemId: string, input: UpdateChecklistItemInput) {
    const item = await this.load(actor, itemId, 'editor')
    const changes: { groupKey?: string; title?: string } = {}
    if (input.groupKey !== undefined) changes.groupKey = input.groupKey
    if (input.title !== undefined) changes.title = input.title
    const row = (await this.checklist.update(itemId, changes)) ?? item
    return toChecklistItemDto(row, await this.checklist.ticks(item.tripId))
  }

  async remove(actor: SessionUser, itemId: string) {
    const item = await this.load(actor, itemId, 'editor')
    await this.checklist.delete(itemId)
    await this.audit.record({
      actorId: actor.id,
      action: 'checklist.delete',
      entityType: 'checklist_item',
      entityId: itemId,
      data: { tripId: item.tripId, title: item.title },
    })
  }

  /** Any member can tick or untick for themselves. */
  async setTicked(actor: SessionUser, itemId: string, ticked: boolean, now = new Date()) {
    const item = await this.load(actor, itemId, 'viewer')
    if (ticked) await this.checklist.tick(itemId, actor.id, now)
    else await this.checklist.untick(itemId, actor.id)
    return toChecklistItemDto(item, await this.checklist.ticks(item.tripId))
  }
}
