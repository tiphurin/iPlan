import { type Executor, schema } from '@iplan/db'

export interface ImportData {
  trip: Omit<typeof schema.trip.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
  items: Omit<typeof schema.tripItem.$inferInsert, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>[]
  checklist: { groupKey: string; title: string; sortOrder: number }[]
  infoCards: Omit<
    typeof schema.infoCard.$inferInsert,
    'id' | 'tripId' | 'createdAt' | 'updatedAt'
  >[]
}

export interface BackupRepository {
  /** Creates the whole trip in one transaction; returns its id. */
  importTrip(ownerId: string, data: ImportData): Promise<string>
}

export class DrizzleBackupRepository implements BackupRepository {
  constructor(private readonly db: Executor) {}

  importTrip(ownerId: string, data: ImportData): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [trip] = await tx
        .insert(schema.trip)
        .values(data.trip)
        .returning({ id: schema.trip.id })
      if (!trip) throw new Error('Trip insert returned nothing')
      await tx.insert(schema.tripMember).values({ tripId: trip.id, userId: ownerId, role: 'owner' })
      if (data.items.length)
        await tx.insert(schema.tripItem).values(data.items.map((i) => ({ ...i, tripId: trip.id })))
      if (data.checklist.length) {
        await tx
          .insert(schema.checklistItem)
          .values(data.checklist.map((c) => ({ ...c, tripId: trip.id })))
      }
      if (data.infoCards.length) {
        await tx
          .insert(schema.infoCard)
          .values(data.infoCards.map((c) => ({ ...c, tripId: trip.id })))
      }
      return trip.id
    })
  }
}
