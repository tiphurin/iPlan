import type { TripRole } from '@iplan/contracts'
import { type Executor, schema } from '@iplan/db'
import { and, asc, count, eq, inArray } from 'drizzle-orm'

export type TripRow = typeof schema.trip.$inferSelect
export type NewTripRow = Omit<typeof schema.trip.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>

export interface TripWithRole {
  trip: TripRow
  role: TripRole
  memberCount: number
}

export interface MemberRow {
  userId: string
  name: string
  image: string | null
  role: TripRole
}

export interface TripsRepository {
  listForUser(userId: string): Promise<TripWithRole[]>
  /** Null when the trip does not exist or the user is not a member. */
  findForUser(tripId: string, userId: string): Promise<TripWithRole | null>
  members(tripId: string): Promise<MemberRow[]>
  create(values: NewTripRow, ownerId: string): Promise<TripRow>
  update(tripId: string, changes: Partial<NewTripRow>): Promise<TripRow | null>
  delete(tripId: string): Promise<void>
}

export class DrizzleTripsRepository implements TripsRepository {
  constructor(private readonly db: Executor) {}

  private async memberCounts(tripIds: string[]): Promise<Map<string, number>> {
    if (tripIds.length === 0) return new Map()
    const rows = await this.db
      .select({ tripId: schema.tripMember.tripId, n: count() })
      .from(schema.tripMember)
      .where(inArray(schema.tripMember.tripId, tripIds))
      .groupBy(schema.tripMember.tripId)
    return new Map(rows.map((r) => [r.tripId, r.n]))
  }

  async listForUser(userId: string): Promise<TripWithRole[]> {
    const rows = await this.db
      .select({ trip: schema.trip, role: schema.tripMember.role })
      .from(schema.tripMember)
      .innerJoin(schema.trip, eq(schema.trip.id, schema.tripMember.tripId))
      .where(eq(schema.tripMember.userId, userId))
      .orderBy(asc(schema.trip.startDate))
    const counts = await this.memberCounts(rows.map((r) => r.trip.id))
    return rows.map((r) => ({ ...r, memberCount: counts.get(r.trip.id) ?? 1 }))
  }

  async findForUser(tripId: string, userId: string): Promise<TripWithRole | null> {
    const [row] = await this.db
      .select({ trip: schema.trip, role: schema.tripMember.role })
      .from(schema.tripMember)
      .innerJoin(schema.trip, eq(schema.trip.id, schema.tripMember.tripId))
      .where(and(eq(schema.tripMember.tripId, tripId), eq(schema.tripMember.userId, userId)))
      .limit(1)
    if (!row) return null
    const counts = await this.memberCounts([tripId])
    return { ...row, memberCount: counts.get(tripId) ?? 1 }
  }

  async members(tripId: string): Promise<MemberRow[]> {
    return this.db
      .select({
        userId: schema.tripMember.userId,
        name: schema.user.name,
        image: schema.user.image,
        role: schema.tripMember.role,
      })
      .from(schema.tripMember)
      .innerJoin(schema.user, eq(schema.user.id, schema.tripMember.userId))
      .where(eq(schema.tripMember.tripId, tripId))
      .orderBy(asc(schema.tripMember.joinedAt))
  }

  async create(values: NewTripRow, ownerId: string): Promise<TripRow> {
    return this.db.transaction(async (tx) => {
      const [trip] = await tx.insert(schema.trip).values(values).returning()
      if (!trip) throw new Error('Trip insert returned nothing')
      await tx.insert(schema.tripMember).values({ tripId: trip.id, userId: ownerId, role: 'owner' })
      return trip
    })
  }

  async update(tripId: string, changes: Partial<NewTripRow>): Promise<TripRow | null> {
    const [row] = await this.db
      .update(schema.trip)
      .set(changes)
      .where(eq(schema.trip.id, tripId))
      .returning()
    return row ?? null
  }

  async delete(tripId: string): Promise<void> {
    await this.db.delete(schema.trip).where(eq(schema.trip.id, tripId))
  }
}
