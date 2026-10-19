import { type Executor, schema } from '@iplan/db'
import { and, eq, inArray } from 'drizzle-orm'
import { avatarUrl } from '../../shared/avatar'

export type InvitationKind = 'trip' | 'ledger'
export type InvitationRow = typeof schema.invitation.$inferSelect

export interface PendingRow {
  id: string
  userId: string
  name: string
  image: string | null
  role: string
}

export interface MineRow extends InvitationRow {
  targetName: string
  invitedByName: string | null
}

export interface InvitationsRepository {
  create(values: {
    kind: InvitationKind
    targetId: string
    userId: string
    role: string
    invitedBy: string
  }): Promise<string | null>
  find(id: string): Promise<InvitationRow | null>
  forTarget(kind: InvitationKind, targetId: string): Promise<PendingRow[]>
  forUser(userId: string): Promise<MineRow[]>
  /**
   * Adds the membership and removes the invitation in one transaction. false when the
   * trip or wallet no longer exists (the invitation is removed as well).
   */
  accept(invitation: InvitationRow): Promise<boolean>
  delete(id: string): Promise<void>
}

export class DrizzleInvitationsRepository implements InvitationsRepository {
  constructor(private readonly db: Executor) {}

  async create(values: Parameters<InvitationsRepository['create']>[0]) {
    const [row] = await this.db
      .insert(schema.invitation)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: schema.invitation.id })
    return row?.id ?? null
  }

  async find(id: string) {
    const [row] = await this.db.select().from(schema.invitation).where(eq(schema.invitation.id, id))
    return row ?? null
  }

  async forTarget(kind: InvitationKind, targetId: string): Promise<PendingRow[]> {
    const rows = await this.db
      .select({
        id: schema.invitation.id,
        userId: schema.invitation.userId,
        role: schema.invitation.role,
        name: schema.user.name,
        image: schema.user.image,
        avatarKey: schema.user.avatarKey,
      })
      .from(schema.invitation)
      .innerJoin(schema.user, eq(schema.user.id, schema.invitation.userId))
      .where(and(eq(schema.invitation.kind, kind), eq(schema.invitation.targetId, targetId)))
    return rows.map(({ avatarKey, ...r }) => ({
      ...r,
      image: avatarUrl({ id: r.userId, image: r.image, avatarKey }),
    }))
  }

  async forUser(userId: string): Promise<MineRow[]> {
    const rows = await this.db
      .select({ invitation: schema.invitation, invitedByName: schema.user.name })
      .from(schema.invitation)
      .leftJoin(schema.user, eq(schema.user.id, schema.invitation.invitedBy))
      .where(eq(schema.invitation.userId, userId))
    const ids = (kind: InvitationKind) =>
      rows.filter((r) => r.invitation.kind === kind).map((r) => r.invitation.targetId)
    const [trips, ledgers] = await Promise.all([
      ids('trip').length
        ? this.db
            .select({ id: schema.trip.id, name: schema.trip.name })
            .from(schema.trip)
            .where(inArray(schema.trip.id, ids('trip')))
        : [],
      ids('ledger').length
        ? this.db
            .select({ id: schema.ledger.id, name: schema.ledger.name })
            .from(schema.ledger)
            .where(inArray(schema.ledger.id, ids('ledger')))
        : [],
    ])
    const names = new Map([...trips, ...ledgers].map((t) => [t.id, t.name]))
    return rows.flatMap((r) => {
      const targetName = names.get(r.invitation.targetId)
      return targetName ? [{ ...r.invitation, targetName, invitedByName: r.invitedByName }] : []
    })
  }

  async accept(invitation: InvitationRow) {
    return this.db.transaction(async (tx) => {
      // Locked so the target can't be deleted between this check and the insert.
      const [target] =
        invitation.kind === 'trip'
          ? await tx
              .select({ id: schema.trip.id })
              .from(schema.trip)
              .where(eq(schema.trip.id, invitation.targetId))
              .for('share')
          : await tx
              .select({ id: schema.ledger.id })
              .from(schema.ledger)
              .where(eq(schema.ledger.id, invitation.targetId))
              .for('share')
      if (!target) {
        await tx.delete(schema.invitation).where(eq(schema.invitation.id, invitation.id))
        return false
      }
      if (invitation.kind === 'trip') {
        await tx
          .insert(schema.tripMember)
          .values({
            tripId: invitation.targetId,
            userId: invitation.userId,
            role: invitation.role === 'viewer' ? 'viewer' : 'editor',
          })
          .onConflictDoNothing()
      } else {
        await tx
          .insert(schema.ledgerMember)
          .values({ ledgerId: invitation.targetId, userId: invitation.userId, role: 'member' })
          .onConflictDoNothing()
      }
      await tx.delete(schema.invitation).where(eq(schema.invitation.id, invitation.id))
      return true
    })
  }

  async delete(id: string) {
    await this.db.delete(schema.invitation).where(eq(schema.invitation.id, id))
  }
}
