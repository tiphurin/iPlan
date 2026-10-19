import { type Executor, schema } from '@iplan/db'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { avatarUrl } from '../../shared/avatar'

export type LedgerRow = typeof schema.ledger.$inferSelect
export type EntryRow = typeof schema.ledgerEntry.$inferSelect
export type NewEntryRow = typeof schema.ledgerEntry.$inferInsert
export interface ShareRow {
  userId: string
  amountMinor: bigint
  percentBp: number | null
}
export type EntryWithShares = EntryRow & { shares: ShareRow[] }
export type LedgerRole = 'owner' | 'member'
export interface MemberRow {
  userId: string
  name: string
  email: string
  image: string | null
  role: LedgerRole
}

export interface LedgersRepository {
  listForUser(userId: string): Promise<{ ledger: LedgerRow; role: LedgerRole }[]>
  find(id: string): Promise<LedgerRow | null>
  members(ledgerId: string): Promise<MemberRow[]>
  create(values: { name: string; currency: string; createdBy: string }): Promise<string>
  rename(id: string, name: string): Promise<void>
  delete(id: string): Promise<void>
  addMember(ledgerId: string, userId: string, role: LedgerRole): Promise<void>
  removeMember(ledgerId: string, userId: string): Promise<void>
  findUserByEmail(email: string): Promise<{ id: string; status: string } | null>
  entries(ledgerId: string): Promise<EntryWithShares[]>
  entry(id: string): Promise<EntryWithShares | null>
  insertEntry(values: NewEntryRow, shares: ShareRow[]): Promise<string>
  updateEntry(id: string, values: Partial<NewEntryRow>, shares: ShareRow[]): Promise<void>
  deleteEntry(id: string): Promise<void>
  deleteEntries(ids: string[]): Promise<void>
  /**
   * Runs `fn` in one transaction after locking the ledger row, so two people changing
   * the same wallet's payments at once can't both act on the same old state.
   */
  locked<T>(ledgerId: string, fn: (repo: LedgersRepository) => Promise<T>): Promise<T>
}

export class DrizzleLedgersRepository implements LedgersRepository {
  constructor(private readonly db: Executor) {}

  async listForUser(userId: string) {
    const rows = await this.db
      .select({ ledger: schema.ledger, role: schema.ledgerMember.role })
      .from(schema.ledgerMember)
      .innerJoin(schema.ledger, eq(schema.ledger.id, schema.ledgerMember.ledgerId))
      .where(eq(schema.ledgerMember.userId, userId))
      .orderBy(asc(schema.ledger.createdAt))
    return rows
  }

  async find(id: string) {
    const [row] = await this.db.select().from(schema.ledger).where(eq(schema.ledger.id, id))
    return row ?? null
  }

  async members(ledgerId: string): Promise<MemberRow[]> {
    const rows = await this.db
      .select({
        userId: schema.ledgerMember.userId,
        name: schema.user.name,
        email: schema.user.email,
        image: schema.user.image,
        avatarKey: schema.user.avatarKey,
        role: schema.ledgerMember.role,
      })
      .from(schema.ledgerMember)
      .innerJoin(schema.user, eq(schema.user.id, schema.ledgerMember.userId))
      .where(eq(schema.ledgerMember.ledgerId, ledgerId))
      .orderBy(asc(schema.ledgerMember.joinedAt))
    return rows.map(({ avatarKey, ...m }) => ({
      ...m,
      image: avatarUrl({ id: m.userId, image: m.image, avatarKey }),
    }))
  }

  async create(values: { name: string; currency: string; createdBy: string }) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.ledger)
        .values(values)
        .returning({ id: schema.ledger.id })
      if (!row) throw new Error('Insert returned no row')
      await tx
        .insert(schema.ledgerMember)
        .values({ ledgerId: row.id, userId: values.createdBy, role: 'owner' })
      return row.id
    })
  }

  async rename(id: string, name: string) {
    await this.db.update(schema.ledger).set({ name }).where(eq(schema.ledger.id, id))
  }

  async delete(id: string) {
    await this.db.delete(schema.ledger).where(eq(schema.ledger.id, id))
  }

  async addMember(ledgerId: string, userId: string, role: LedgerRole) {
    await this.db.insert(schema.ledgerMember).values({ ledgerId, userId, role })
  }

  async removeMember(ledgerId: string, userId: string) {
    await this.db
      .delete(schema.ledgerMember)
      .where(
        and(eq(schema.ledgerMember.ledgerId, ledgerId), eq(schema.ledgerMember.userId, userId)),
      )
  }

  async findUserByEmail(email: string) {
    const [row] = await this.db
      .select({ id: schema.user.id, status: schema.user.status })
      .from(schema.user)
      .where(eq(schema.user.email, email))
    return row ?? null
  }

  private async withShares(rows: EntryRow[]): Promise<EntryWithShares[]> {
    if (rows.length === 0) return []
    const shares = await this.db
      .select()
      .from(schema.ledgerShare)
      .where(
        inArray(
          schema.ledgerShare.entryId,
          rows.map((r) => r.id),
        ),
      )
    return rows.map((row) => ({
      ...row,
      shares: shares
        .filter((s) => s.entryId === row.id)
        .map(({ userId, amountMinor, percentBp }) => ({ userId, amountMinor, percentBp })),
    }))
  }

  async entries(ledgerId: string) {
    const rows = await this.db
      .select()
      .from(schema.ledgerEntry)
      .where(eq(schema.ledgerEntry.ledgerId, ledgerId))
      .orderBy(desc(schema.ledgerEntry.date), desc(schema.ledgerEntry.createdAt))
    return this.withShares(rows)
  }

  async entry(id: string) {
    const rows = await this.db
      .select()
      .from(schema.ledgerEntry)
      .where(eq(schema.ledgerEntry.id, id))
    return (await this.withShares(rows))[0] ?? null
  }

  async insertEntry(values: NewEntryRow, shares: ShareRow[]) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.ledgerEntry)
        .values(values)
        .returning({ id: schema.ledgerEntry.id })
      if (!row) throw new Error('Insert returned no row')
      await tx.insert(schema.ledgerShare).values(shares.map((s) => ({ ...s, entryId: row.id })))
      return row.id
    })
  }

  async updateEntry(id: string, values: Partial<NewEntryRow>, shares: ShareRow[]) {
    await this.db.transaction(async (tx) => {
      await tx.update(schema.ledgerEntry).set(values).where(eq(schema.ledgerEntry.id, id))
      await tx.delete(schema.ledgerShare).where(eq(schema.ledgerShare.entryId, id))
      await tx.insert(schema.ledgerShare).values(shares.map((s) => ({ ...s, entryId: id })))
    })
  }

  async deleteEntries(ids: string[]) {
    if (ids.length === 0) return
    await this.db.delete(schema.ledgerEntry).where(inArray(schema.ledgerEntry.id, ids))
  }

  async deleteEntry(id: string) {
    await this.db.delete(schema.ledgerEntry).where(eq(schema.ledgerEntry.id, id))
  }

  async locked<T>(ledgerId: string, fn: (repo: LedgersRepository) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: schema.ledger.id })
        .from(schema.ledger)
        .where(eq(schema.ledger.id, ledgerId))
        .for('update')
      return fn(new DrizzleLedgersRepository(tx))
    })
  }
}
