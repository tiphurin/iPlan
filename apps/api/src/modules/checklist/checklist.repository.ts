import { type Executor, schema } from '@iplan/db'
import { and, asc, eq, max } from 'drizzle-orm'

export type ChecklistRow = typeof schema.checklistItem.$inferSelect
export interface TickRow {
  itemId: string
  userId: string
  name: string
  tickedAt: Date
}

export interface ChecklistRepository {
  list(tripId: string): Promise<ChecklistRow[]>
  ticks(tripId: string): Promise<TickRow[]>
  find(itemId: string): Promise<ChecklistRow | null>
  nextSortOrder(tripId: string, groupKey: string): Promise<number>
  create(values: {
    tripId: string
    groupKey: string
    title: string
    sortOrder: number
  }): Promise<ChecklistRow>
  update(
    itemId: string,
    changes: { groupKey?: string; title?: string },
  ): Promise<ChecklistRow | null>
  delete(itemId: string): Promise<void>
  tick(itemId: string, userId: string, at: Date): Promise<void>
  untick(itemId: string, userId: string): Promise<void>
}

export class DrizzleChecklistRepository implements ChecklistRepository {
  constructor(private readonly db: Executor) {}

  list(tripId: string) {
    return this.db
      .select()
      .from(schema.checklistItem)
      .where(eq(schema.checklistItem.tripId, tripId))
      .orderBy(asc(schema.checklistItem.groupKey), asc(schema.checklistItem.sortOrder))
  }

  ticks(tripId: string) {
    return this.db
      .select({
        itemId: schema.checklistTick.itemId,
        userId: schema.checklistTick.userId,
        name: schema.user.name,
        tickedAt: schema.checklistTick.tickedAt,
      })
      .from(schema.checklistTick)
      .innerJoin(schema.checklistItem, eq(schema.checklistItem.id, schema.checklistTick.itemId))
      .innerJoin(schema.user, eq(schema.user.id, schema.checklistTick.userId))
      .where(eq(schema.checklistItem.tripId, tripId))
      .orderBy(asc(schema.checklistTick.tickedAt))
  }

  async find(itemId: string) {
    const [row] = await this.db
      .select()
      .from(schema.checklistItem)
      .where(eq(schema.checklistItem.id, itemId))
      .limit(1)
    return row ?? null
  }

  async nextSortOrder(tripId: string, groupKey: string) {
    const [row] = await this.db
      .select({ value: max(schema.checklistItem.sortOrder) })
      .from(schema.checklistItem)
      .where(
        and(eq(schema.checklistItem.tripId, tripId), eq(schema.checklistItem.groupKey, groupKey)),
      )
    return (row?.value ?? -1) + 1
  }

  async create(values: { tripId: string; groupKey: string; title: string; sortOrder: number }) {
    const [row] = await this.db.insert(schema.checklistItem).values(values).returning()
    if (!row) throw new Error('Checklist insert returned nothing')
    return row
  }

  async update(itemId: string, changes: { groupKey?: string; title?: string }) {
    const [row] = await this.db
      .update(schema.checklistItem)
      .set(changes)
      .where(eq(schema.checklistItem.id, itemId))
      .returning()
    return row ?? null
  }

  async delete(itemId: string) {
    await this.db.delete(schema.checklistItem).where(eq(schema.checklistItem.id, itemId))
  }

  async tick(itemId: string, userId: string, at: Date) {
    await this.db
      .insert(schema.checklistTick)
      .values({ itemId, userId, tickedAt: at })
      .onConflictDoNothing()
  }

  async untick(itemId: string, userId: string) {
    await this.db
      .delete(schema.checklistTick)
      .where(and(eq(schema.checklistTick.itemId, itemId), eq(schema.checklistTick.userId, userId)))
  }
}
