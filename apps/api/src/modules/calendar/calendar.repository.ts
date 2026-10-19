import { type Executor, schema } from '@iplan/db'
import { and, eq } from 'drizzle-orm'

export interface FeedOwner {
  userId: string
  tripId: string
  status: string
  banned: boolean | null
  role: string
}

export interface CalendarFeedsRepository {
  find(token: string): Promise<FeedOwner | null>
  tokenFor(userId: string, tripId: string): Promise<string | null>
  /** Replaces any previous token for this person and trip. */
  save(userId: string, tripId: string, token: string): Promise<void>
}

export class DrizzleCalendarFeedsRepository implements CalendarFeedsRepository {
  constructor(private readonly db: Executor) {}

  async find(token: string) {
    const [row] = await this.db
      .select({
        userId: schema.calendarFeed.userId,
        tripId: schema.calendarFeed.tripId,
        status: schema.user.status,
        banned: schema.user.banned,
        role: schema.user.role,
      })
      .from(schema.calendarFeed)
      .innerJoin(schema.user, eq(schema.user.id, schema.calendarFeed.userId))
      .where(eq(schema.calendarFeed.token, token))
    return row ?? null
  }

  async tokenFor(userId: string, tripId: string) {
    const [row] = await this.db
      .select({ token: schema.calendarFeed.token })
      .from(schema.calendarFeed)
      .where(and(eq(schema.calendarFeed.userId, userId), eq(schema.calendarFeed.tripId, tripId)))
    return row?.token ?? null
  }

  async save(userId: string, tripId: string, token: string) {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.calendarFeed)
        .where(and(eq(schema.calendarFeed.userId, userId), eq(schema.calendarFeed.tripId, tripId)))
      await tx.insert(schema.calendarFeed).values({ userId, tripId, token })
    })
  }
}
