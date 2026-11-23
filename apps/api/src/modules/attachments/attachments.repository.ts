import type { AttachmentEntity } from '@iplan/contracts'
import { type Executor, schema } from '@iplan/db'
import { and, asc, count, eq } from 'drizzle-orm'

export type AttachmentRow = typeof schema.attachment.$inferSelect
export type NewAttachmentRow = Omit<typeof schema.attachment.$inferInsert, 'id' | 'createdAt'>

export type AttachmentScope = { tripId: string } | { ownerId: string }

export interface AttachmentsRepository {
  /** Who controls the entity: a trip (shared) or a single owner (personal finance). */
  scopeOf(entityType: AttachmentEntity, entityId: string): Promise<AttachmentScope | null>
  list(entityType: AttachmentEntity, entityId: string): Promise<AttachmentRow[]>
  /** Files per plan item of one trip, for the 📷 count on the timeline. */
  countPerItem(tripId: string): Promise<Record<string, number>>
  find(id: string): Promise<AttachmentRow | null>
  create(values: NewAttachmentRow): Promise<AttachmentRow>
  delete(id: string): Promise<void>
}

export class DrizzleAttachmentsRepository implements AttachmentsRepository {
  constructor(private readonly db: Executor) {}

  async scopeOf(entityType: AttachmentEntity, entityId: string): Promise<AttachmentScope | null> {
    if (entityType === 'transaction') {
      const [row] = await this.db
        .select({ ownerId: schema.financeTransaction.ownerId })
        .from(schema.financeTransaction)
        .where(eq(schema.financeTransaction.id, entityId))
        .limit(1)
      return row ? { ownerId: row.ownerId } : null
    }
    const table = entityType === 'expense' ? schema.expense : schema.tripItem
    const [row] = await this.db
      .select({ tripId: table.tripId })
      .from(table)
      .where(eq(table.id, entityId))
      .limit(1)
    return row ? { tripId: row.tripId } : null
  }

  list(entityType: AttachmentEntity, entityId: string) {
    return this.db
      .select()
      .from(schema.attachment)
      .where(
        and(eq(schema.attachment.entityType, entityType), eq(schema.attachment.entityId, entityId)),
      )
      .orderBy(asc(schema.attachment.createdAt))
  }

  async countPerItem(tripId: string) {
    const rows = await this.db
      .select({ entityId: schema.attachment.entityId, n: count() })
      .from(schema.attachment)
      .where(
        and(eq(schema.attachment.tripId, tripId), eq(schema.attachment.entityType, 'trip_item')),
      )
      .groupBy(schema.attachment.entityId)
    return Object.fromEntries(rows.map((r) => [r.entityId, Number(r.n)]))
  }

  async find(id: string) {
    const [row] = await this.db
      .select()
      .from(schema.attachment)
      .where(eq(schema.attachment.id, id))
      .limit(1)
    return row ?? null
  }

  async create(values: NewAttachmentRow) {
    const [row] = await this.db.insert(schema.attachment).values(values).returning()
    if (!row) throw new Error('Attachment insert returned nothing')
    return row
  }

  async delete(id: string) {
    await this.db.delete(schema.attachment).where(eq(schema.attachment.id, id))
  }
}
