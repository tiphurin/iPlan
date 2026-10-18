import type { CreateInfoCardInput, InfoCardDto, UpdateInfoCardInput } from '@iplan/contracts'
import type { AuditLog } from '../../shared/audit'
import type { SessionUser } from '../../shared/context'
import { notFound } from '../../shared/errors'
import type { TripAccess } from '../trips/trips.service'
import { toInfoCardDto } from './info-cards.mapper'
import type { InfoCardFields, InfoCardsRepository } from './info-cards.repository'

/** Trip facts everyone needs at hand: flights, hotel, emergency numbers, tips. */
export class InfoCardsService {
  constructor(
    private readonly cards: InfoCardsRepository,
    private readonly trips: TripAccess,
    private readonly audit: AuditLog,
  ) {}

  private async load(actor: SessionUser, cardId: string) {
    const card = await this.cards.find(cardId)
    if (!card) throw notFound('Info card')
    await this.trips.requireAccess(actor, card.tripId, 'editor')
    return card
  }

  async list(actor: SessionUser, tripId: string): Promise<InfoCardDto[]> {
    await this.trips.requireAccess(actor, tripId, 'viewer')
    return (await this.cards.list(tripId)).map(toInfoCardDto)
  }

  async create(
    actor: SessionUser,
    tripId: string,
    input: CreateInfoCardInput,
  ): Promise<InfoCardDto> {
    await this.trips.requireAccess(actor, tripId, 'editor')
    const row = await this.cards.create({
      tripId,
      ...input,
      sortOrder: await this.cards.nextSortOrder(tripId),
    })
    await this.audit.record({
      actorId: actor.id,
      action: 'info.create',
      entityType: 'info_card',
      entityId: row.id,
      data: { tripId, title: row.title },
    })
    return toInfoCardDto(row)
  }

  async update(
    actor: SessionUser,
    cardId: string,
    input: UpdateInfoCardInput,
  ): Promise<InfoCardDto> {
    const card = await this.load(actor, cardId)
    const changes: Partial<InfoCardFields> = {}
    if (input.kind !== undefined) changes.kind = input.kind
    if (input.title !== undefined) changes.title = input.title
    if (input.body !== undefined) changes.body = input.body
    const row = (await this.cards.update(cardId, changes)) ?? card
    await this.audit.record({
      actorId: actor.id,
      action: 'info.update',
      entityType: 'info_card',
      entityId: cardId,
      data: { fields: Object.keys(changes) },
    })
    return toInfoCardDto(row)
  }

  async remove(actor: SessionUser, cardId: string) {
    const card = await this.load(actor, cardId)
    await this.cards.delete(cardId)
    await this.audit.record({
      actorId: actor.id,
      action: 'info.delete',
      entityType: 'info_card',
      entityId: cardId,
      data: { tripId: card.tripId, title: card.title },
    })
  }
}
