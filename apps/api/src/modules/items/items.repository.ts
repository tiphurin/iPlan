import { type Executor, schema } from '@iplan/db'
import { and, asc, eq, max } from 'drizzle-orm'

export type ItemRow = typeof schema.tripItem.$inferSelect
export type NewItemRow = Omit<typeof schema.tripItem.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>

export interface CheckInRow {
  itemId: string
  userId: string
  name: string
  checkedInAt: Date
}

export interface ItemsRepository {
  listByTrip(tripId: string): Promise<ItemRow[]>
  checkInsByTrip(tripId: string): Promise<CheckInRow[]>
  checkInsByItem(itemId: string): Promise<CheckInRow[]>
  findById(itemId: string): Promise<ItemRow | null>
  nextSortOrder(tripId: string, dayDate: string): Promise<number>
  create(values: NewItemRow): Promise<ItemRow>
  update(itemId: string, changes: Partial<NewItemRow>): Promise<ItemRow | null>
  delete(itemId: string): Promise<void>
  upsertCheckIn(itemId: string, userId: string, at: Date): Promise<void>
  deleteCheckIn(itemId: string, userId: string): Promise<void>
}

export class DrizzleItemsRepository implements ItemsRepository {
  constructor(private readonly db: Executor) {}

  listByTrip(tripId: string): Promise<ItemRow[]> {
    return this.db
      .select()
      .from(schema.tripItem)
      .where(eq(schema.tripItem.tripId, tripId))
      .orderBy(asc(schema.tripItem.startsAt), asc(schema.tripItem.sortOrder))
  }

  private checkIns() {
    return this.db
      .select({
        itemId: schema.tripItemCheckIn.itemId,
        userId: schema.tripItemCheckIn.userId,
        name: schema.user.name,
        checkedInAt: schema.tripItemCheckIn.checkedInAt,
      })
      .from(schema.tripItemCheckIn)
      .innerJoin(schema.user, eq(schema.user.id, schema.tripItemCheckIn.userId))
  }

  checkInsByTrip(tripId: string): Promise<CheckInRow[]> {
    return this.checkIns()
      .innerJoin(schema.tripItem, eq(schema.tripItem.id, schema.tripItemCheckIn.itemId))
      .where(eq(schema.tripItem.tripId, tripId))
      .orderBy(asc(schema.tripItemCheckIn.checkedInAt))
  }

  checkInsByItem(itemId: string): Promise<CheckInRow[]> {
    return this.checkIns()
      .where(eq(schema.tripItemCheckIn.itemId, itemId))
      .orderBy(asc(schema.tripItemCheckIn.checkedInAt))
  }

  async findById(itemId: string): Promise<ItemRow | null> {
    const [row] = await this.db
      .select()
      .from(schema.tripItem)
      .where(eq(schema.tripItem.id, itemId))
      .limit(1)
    return row ?? null
  }

  async nextSortOrder(tripId: string, dayDate: string): Promise<number> {
    const [row] = await this.db
      .select({ value: max(schema.tripItem.sortOrder) })
      .from(schema.tripItem)
      .where(and(eq(schema.tripItem.tripId, tripId), eq(schema.tripItem.dayDate, dayDate)))
    return (row?.value ?? -1) + 1
  }

  async create(values: NewItemRow): Promise<ItemRow> {
    const [row] = await this.db.insert(schema.tripItem).values(values).returning()
    if (!row) throw new Error('Item insert returned nothing')
    return row
  }

  async update(itemId: string, changes: Partial<NewItemRow>): Promise<ItemRow | null> {
    const [row] = await this.db
      .update(schema.tripItem)
      .set(changes)
      .where(eq(schema.tripItem.id, itemId))
      .returning()
    return row ?? null
  }

  async delete(itemId: string): Promise<void> {
    await this.db.delete(schema.tripItem).where(eq(schema.tripItem.id, itemId))
  }

  async upsertCheckIn(itemId: string, userId: string, at: Date): Promise<void> {
    await this.db
      .insert(schema.tripItemCheckIn)
      .values({ itemId, userId, checkedInAt: at })
      .onConflictDoUpdate({
        target: [schema.tripItemCheckIn.itemId, schema.tripItemCheckIn.userId],
        set: { checkedInAt: at },
      })
  }

  async deleteCheckIn(itemId: string, userId: string): Promise<void> {
    await this.db
      .delete(schema.tripItemCheckIn)
      .where(
        and(eq(schema.tripItemCheckIn.itemId, itemId), eq(schema.tripItemCheckIn.userId, userId)),
      )
  }
}
