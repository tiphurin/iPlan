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
        ? or(ilike(schema.user.name, `%${query}%`), ilike(schema.user.email, `%${query}%`))
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
