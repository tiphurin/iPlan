import { type Executor, schema } from '@iplan/db'
import { and, count, desc, eq, gt, ilike, or, sql, sum } from 'drizzle-orm'

export const PAGE_SIZE = 25

export interface StatsRow {
  users: number
  newUsers30d: number
  suspendedUsers: number
  pendingUsers: number
  activeSessions: number
  trips: number
  tripItems: number
  expenses: number
  transactions: number
  attachments: number
  storageBytes: number
  databaseBytes: number
}

export type UserRow = typeof schema.user.$inferSelect & { trips: number }
export interface AdminTripRow {
  id: string
  name: string
  destination: string | null
  startDate: string
  endDate: string
  ownerName: string | null
  memberCount: number
}
export interface AdminLedgerRow {
  id: string
  name: string
  ownerName: string | null
  memberCount: number
  entryCount: number
}
export type AuditRow = typeof schema.auditLog.$inferSelect & { actorName: string | null }

export interface AdminRepository {
  stats(now: Date): Promise<StatsRow>
  users(
    query: string | undefined,
    page: number,
    status?: string,
  ): Promise<{ rows: UserRow[]; total: number }>
  user(id: string): Promise<UserRow | null>
  updateUser(
    id: string,
    changes: { role?: string; status?: string; banned?: boolean; banReason?: string | null },
  ): Promise<void>
  revokeSessions(userId: string): Promise<void>
  allTrips(): Promise<AdminTripRow[]>
  allLedgers(): Promise<AdminLedgerRow[]>
  audit(page: number, action: string | undefined): Promise<{ rows: AuditRow[]; total: number }>
}

const n = (value: unknown) => Number(value ?? 0)

export class DrizzleAdminRepository implements AdminRepository {
  constructor(private readonly db: Executor) {}

  async stats(now: Date): Promise<StatsRow> {
    const monthAgo = new Date(now.getTime() - 30 * 86_400_000)
    const one = async (q: Promise<{ value: number | string | null }[]>) => n((await q)[0]?.value)
    const [
      users,
      newUsers30d,
      suspendedUsers,
      pendingUsers,
      activeSessions,
      trips,
      tripItems,
      expenses,
      transactions,
      attachments,
      storageBytes,
      db,
    ] = await Promise.all([
      one(this.db.select({ value: count() }).from(schema.user)),
      one(
        this.db
          .select({ value: count() })
          .from(schema.user)
          .where(gt(schema.user.createdAt, monthAgo)),
      ),
      one(this.db.select({ value: count() }).from(schema.user).where(eq(schema.user.banned, true))),
      one(
        this.db
          .select({ value: count() })
          .from(schema.user)
          .where(eq(schema.user.status, 'pending')),
      ),
      one(
        this.db
          .select({ value: count() })
          .from(schema.session)
          .where(gt(schema.session.expiresAt, now)),
      ),
      one(this.db.select({ value: count() }).from(schema.trip)),
      one(this.db.select({ value: count() }).from(schema.tripItem)),
      one(this.db.select({ value: count() }).from(schema.expense)),
      one(this.db.select({ value: count() }).from(schema.financeTransaction)),
      one(this.db.select({ value: count() }).from(schema.attachment)),
      one(this.db.select({ value: sum(schema.attachment.sizeBytes) }).from(schema.attachment)),
      this.db.execute<{ size: string }>(
        sql`select pg_database_size(current_database())::text as size`,
      ),
    ])
    return {
      users,
      newUsers30d,
      suspendedUsers,
      pendingUsers,
      activeSessions,
      trips,
      tripItems,
      expenses,
      transactions,
      attachments,
      storageBytes,
      databaseBytes: n(db.rows[0]?.size),
    }
  }

  private userSelect() {
    return this.db
      .select({
        user: schema.user,
        trips: sql<number>`(select count(*) from ${schema.tripMember} where ${schema.tripMember.userId} = ${schema.user.id})::int`,
      })
      .from(schema.user)
  }

  async users(query: string | undefined, page: number, status?: string) {
    const where = and(
      query
        ? or(
            ilike(schema.user.name, `%${query}%`),
            ilike(schema.user.email, `%${query}%`),
            ilike(schema.user.nickname, `%${query}%`),
          )
        : undefined,
      status ? eq(schema.user.status, status) : undefined,
    )
    const [rows, totals] = await Promise.all([
      this.userSelect()
        .where(where)
        .orderBy(desc(schema.user.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      this.db.select({ value: count() }).from(schema.user).where(where),
    ])
    return { rows: rows.map((r) => ({ ...r.user, trips: r.trips })), total: n(totals[0]?.value) }
  }

  async user(id: string) {
    const [row] = await this.userSelect().where(eq(schema.user.id, id)).limit(1)
    return row ? { ...row.user, trips: row.trips } : null
  }

  async updateUser(
    id: string,
    changes: { role?: string; status?: string; banned?: boolean; banReason?: string | null },
  ) {
    await this.db.update(schema.user).set(changes).where(eq(schema.user.id, id))
  }

  async allTrips(): Promise<AdminTripRow[]> {
    return this.db
      .select({
        id: schema.trip.id,
        name: schema.trip.name,
        destination: schema.trip.destination,
        startDate: schema.trip.startDate,
        endDate: schema.trip.endDate,
        ownerName: sql<
          string | null
        >`(select u.name from ${schema.tripMember} m join ${schema.user} u on u.id = m.user_id where m.trip_id = "trip"."id" and m.role = 'owner' limit 1)`,
        memberCount: sql<number>`(select count(*) from ${schema.tripMember} m where m.trip_id = "trip"."id")::int`,
      })
      .from(schema.trip)
      .orderBy(desc(schema.trip.startDate))
      .limit(200)
  }

  async allLedgers(): Promise<AdminLedgerRow[]> {
    return this.db
      .select({
        id: schema.ledger.id,
        name: schema.ledger.name,
        ownerName: sql<
          string | null
        >`(select u.name from ${schema.ledgerMember} m join ${schema.user} u on u.id = m.user_id where m.ledger_id = "ledger"."id" and m.role = 'owner' limit 1)`,
        memberCount: sql<number>`(select count(*) from ${schema.ledgerMember} m where m.ledger_id = "ledger"."id")::int`,
        entryCount: sql<number>`(select count(*) from ${schema.ledgerEntry} e where e.ledger_id = "ledger"."id" and e.kind = 'expense')::int`,
      })
      .from(schema.ledger)
      .orderBy(desc(schema.ledger.createdAt))
      .limit(200)
  }

  async revokeSessions(userId: string) {
    await this.db.delete(schema.session).where(eq(schema.session.userId, userId))
  }

  async audit(page: number, action: string | undefined) {
    const where = action ? and(ilike(schema.auditLog.action, `${action}%`)) : undefined
    const [rows, totals] = await Promise.all([
      this.db
        .select({ entry: schema.auditLog, actorName: schema.user.name })
        .from(schema.auditLog)
        .leftJoin(schema.user, eq(schema.user.id, schema.auditLog.actorId))
        .where(where)
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      this.db.select({ value: count() }).from(schema.auditLog).where(where),
    ])
    return {
      rows: rows.map((r) => ({ ...r.entry, actorName: r.actorName })),
      total: n(totals[0]?.value),
    }
  }
}
