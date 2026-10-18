import type { InviteRole, TripRole } from '@iplan/contracts'
import { type Executor, schema } from '@iplan/db'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'

export type InviteRow = typeof schema.tripInvite.$inferSelect

export interface InviteWithTrip {
  invite: InviteRow
  tripName: string
  startDate: string
  endDate: string
  invitedBy: string | null
}

export interface MembersRepository {
  roleOf(tripId: string, userId: string): Promise<TripRole | null>
  setRole(tripId: string, userId: string, role: TripRole): Promise<void>
  remove(tripId: string, userId: string): Promise<void>
  add(tripId: string, userId: string, role: TripRole): Promise<void>
  createInvite(values: {
    tripId: string
    token: string
    role: InviteRole
    createdBy: string
    expiresAt: Date
  }): Promise<InviteRow>
  activeInvites(tripId: string, now: Date): Promise<InviteRow[]>
  findInvite(inviteId: string): Promise<InviteRow | null>
  findInviteByToken(token: string): Promise<InviteWithTrip | null>
  revokeInvite(inviteId: string, at: Date): Promise<void>
  countInviteUse(inviteId: string): Promise<void>
}

export class DrizzleMembersRepository implements MembersRepository {
  constructor(private readonly db: Executor) {}

  async roleOf(tripId: string, userId: string): Promise<TripRole | null> {
    const [row] = await this.db
      .select({ role: schema.tripMember.role })
      .from(schema.tripMember)
      .where(and(eq(schema.tripMember.tripId, tripId), eq(schema.tripMember.userId, userId)))
      .limit(1)
    return row?.role ?? null
  }

  async setRole(tripId: string, userId: string, role: TripRole): Promise<void> {
    await this.db
      .update(schema.tripMember)
      .set({ role })
      .where(and(eq(schema.tripMember.tripId, tripId), eq(schema.tripMember.userId, userId)))
  }

  async remove(tripId: string, userId: string): Promise<void> {
    await this.db
      .delete(schema.tripMember)
      .where(and(eq(schema.tripMember.tripId, tripId), eq(schema.tripMember.userId, userId)))
  }

  async add(tripId: string, userId: string, role: TripRole): Promise<void> {
    await this.db.insert(schema.tripMember).values({ tripId, userId, role }).onConflictDoNothing()
  }

  async createInvite(values: {
    tripId: string
    token: string
    role: InviteRole
    createdBy: string
    expiresAt: Date
  }): Promise<InviteRow> {
    const [row] = await this.db.insert(schema.tripInvite).values(values).returning()
    if (!row) throw new Error('Invite insert returned nothing')
    return row
  }

  activeInvites(tripId: string, now: Date): Promise<InviteRow[]> {
    return this.db
      .select()
      .from(schema.tripInvite)
      .where(
        and(
          eq(schema.tripInvite.tripId, tripId),
          isNull(schema.tripInvite.revokedAt),
          gt(schema.tripInvite.expiresAt, now),
        ),
      )
      .orderBy(desc(schema.tripInvite.createdAt))
  }

  async findInvite(inviteId: string): Promise<InviteRow | null> {
    const [row] = await this.db
      .select()
      .from(schema.tripInvite)
      .where(eq(schema.tripInvite.id, inviteId))
      .limit(1)
    return row ?? null
  }

  async findInviteByToken(token: string): Promise<InviteWithTrip | null> {
    const [row] = await this.db
      .select({
        invite: schema.tripInvite,
        tripName: schema.trip.name,
        startDate: schema.trip.startDate,
        endDate: schema.trip.endDate,
        invitedBy: schema.user.name,
      })
      .from(schema.tripInvite)
      .innerJoin(schema.trip, eq(schema.trip.id, schema.tripInvite.tripId))
      .leftJoin(schema.user, eq(schema.user.id, schema.tripInvite.createdBy))
      .where(eq(schema.tripInvite.token, token))
      .limit(1)
    return row ?? null
  }

  async revokeInvite(inviteId: string, at: Date): Promise<void> {
    await this.db
      .update(schema.tripInvite)
      .set({ revokedAt: at })
      .where(eq(schema.tripInvite.id, inviteId))
  }

  async countInviteUse(inviteId: string): Promise<void> {
    await this.db
      .update(schema.tripInvite)
      .set({ useCount: sql`${schema.tripInvite.useCount} + 1` })
      .where(eq(schema.tripInvite.id, inviteId))
  }
}
