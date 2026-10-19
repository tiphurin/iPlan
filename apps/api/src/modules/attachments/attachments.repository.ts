import type { AttachmentEntity } from '@iplan/contracts'
import { type Executor, schema } from '@iplan/db'
import { and, asc, eq } from 'drizzle-orm'

export type AttachmentRow = typeof schema.attachment.$inferSelect
export type NewAttachmentRow = Omit<typeof schema.attachment.$inferInsert, 'id' | 'createdAt'>

export interface AttachmentsRepository {
  /** Trip that owns the entity, or null when the entity doesn't exist. */
  tripOf(entityType: AttachmentEntity, entityId: string): Promise<string | null>
  list(entityType: AttachmentEntity, entityId: string): Promise<AttachmentRow[]>
  find(id: string): Promise<AttachmentRow | null>
  create(values: NewAttachmentRow): Promise<AttachmentRow>
  delete(id: string): Promise<void>
}

export class DrizzleAttachmentsRepository implements AttachmentsRepository {
  constructor(private readonly db: Executor) {}

  async tripOf(entityType: AttachmentEntity, entityId: string) {
    const table = entityType === 'expense' ? schema.expense : schema.tripItem
    const [row] = await this.db
      .select({ tripId: table.tripId })
      .from(table)
      .where(eq(table.id, entityId))
      .limit(1)
    return row?.tripId ?? null
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
