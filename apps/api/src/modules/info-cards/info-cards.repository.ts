import type { InfoCardKind } from '@iplan/contracts'
import { type Executor, schema } from '@iplan/db'
import { asc, eq, max } from 'drizzle-orm'

export type InfoCardRow = typeof schema.infoCard.$inferSelect
export interface InfoCardFields {
  kind: InfoCardKind
  title: string
  body: string
}

export interface InfoCardsRepository {
  list(tripId: string): Promise<InfoCardRow[]>
  find(cardId: string): Promise<InfoCardRow | null>
  nextSortOrder(tripId: string): Promise<number>
  create(values: InfoCardFields & { tripId: string; sortOrder: number }): Promise<InfoCardRow>
  update(cardId: string, changes: Partial<InfoCardFields>): Promise<InfoCardRow | null>
  delete(cardId: string): Promise<void>
}

export class DrizzleInfoCardsRepository implements InfoCardsRepository {
  constructor(private readonly db: Executor) {}

  list(tripId: string) {
    return this.db
      .select()
      .from(schema.infoCard)
      .where(eq(schema.infoCard.tripId, tripId))
      .orderBy(asc(schema.infoCard.sortOrder))
  }

  async find(cardId: string) {
    const [row] = await this.db
      .select()
      .from(schema.infoCard)
      .where(eq(schema.infoCard.id, cardId))
      .limit(1)
    return row ?? null
  }

  async nextSortOrder(tripId: string) {
    const [row] = await this.db
      .select({ value: max(schema.infoCard.sortOrder) })
      .from(schema.infoCard)
      .where(eq(schema.infoCard.tripId, tripId))
    return (row?.value ?? -1) + 1
  }

  async create(values: InfoCardFields & { tripId: string; sortOrder: number }) {
    const [row] = await this.db.insert(schema.infoCard).values(values).returning()
    if (!row) throw new Error('Info card insert returned nothing')
    return row
  }

  async update(cardId: string, changes: Partial<InfoCardFields>) {
    const [row] = await this.db
      .update(schema.infoCard)
      .set(changes)
      .where(eq(schema.infoCard.id, cardId))
      .returning()
    return row ?? null
  }

  async delete(cardId: string) {
    await this.db.delete(schema.infoCard).where(eq(schema.infoCard.id, cardId))
  }
}
