import { type Executor, schema } from '@iplan/db'
import { and, asc, eq, inArray } from 'drizzle-orm'

export type ExpenseRow = typeof schema.expense.$inferSelect
export type NewExpenseRow = Omit<
  typeof schema.expense.$inferInsert,
  'id' | 'createdAt' | 'updatedAt'
>
export interface ShareRow {
  expenseId: string
  userId: string
  amountMinor: bigint
  percentBp: number | null
}
export type ContributionRow = typeof schema.tripPoolContribution.$inferSelect
export type NewContributionRow = Omit<
  typeof schema.tripPoolContribution.$inferInsert,
  'id' | 'createdAt'
>
export interface ExpenseWithShares {
  expense: ExpenseRow
  shares: ShareRow[]
}

export interface ExpensesRepository {
  list(tripId: string): Promise<ExpenseWithShares[]>
  find(expenseId: string): Promise<ExpenseWithShares | null>
  create(values: NewExpenseRow, shares: Omit<ShareRow, 'expenseId'>[]): Promise<ExpenseWithShares>
  replace(
    expenseId: string,
    values: NewExpenseRow,
    shares: Omit<ShareRow, 'expenseId'>[],
  ): Promise<ExpenseWithShares>
  delete(expenseId: string): Promise<void>
  itemInTrip(itemId: string, tripId: string): Promise<boolean>
  updateTripMoney(
    tripId: string,
    changes: { fxRates?: Record<string, string>; dailyBudgetMinor?: bigint | null },
  ): Promise<void>
  /** Money put into the pool, oldest day first. */
  listContributions(tripId: string): Promise<ContributionRow[]>
  findContribution(id: string): Promise<ContributionRow | null>
  createContribution(values: NewContributionRow): Promise<ContributionRow>
  updateContribution(id: string, values: NewContributionRow): Promise<ContributionRow>
  deleteContribution(id: string): Promise<void>
  updatePoolMode(tripId: string, mode: 'actual' | 'proportional'): Promise<void>
}

export class DrizzleExpensesRepository implements ExpensesRepository {
  constructor(private readonly db: Executor) {}

  private async withShares(rows: ExpenseRow[]): Promise<ExpenseWithShares[]> {
    if (rows.length === 0) return []
    const shares = await this.db
      .select()
      .from(schema.expenseShare)
      .where(
        inArray(
          schema.expenseShare.expenseId,
          rows.map((r) => r.id),
        ),
      )
    return rows.map((expense) => ({
      expense,
      shares: shares.filter((s) => s.expenseId === expense.id),
    }))
  }

  async list(tripId: string) {
    const rows = await this.db
      .select()
      .from(schema.expense)
      .where(eq(schema.expense.tripId, tripId))
      .orderBy(asc(schema.expense.dayDate), asc(schema.expense.createdAt))
    return this.withShares(rows)
  }

  async find(expenseId: string) {
    const rows = await this.db
      .select()
      .from(schema.expense)
      .where(eq(schema.expense.id, expenseId))
      .limit(1)
    return (await this.withShares(rows))[0] ?? null
  }

  async create(values: NewExpenseRow, shares: Omit<ShareRow, 'expenseId'>[]) {
    return this.db.transaction(async (tx) => {
      const [expense] = await tx.insert(schema.expense).values(values).returning()
      if (!expense) throw new Error('Expense insert returned nothing')
      const saved = await tx
        .insert(schema.expenseShare)
        .values(shares.map((s) => ({ ...s, expenseId: expense.id })))
        .returning()
      return { expense, shares: saved }
    })
  }

  async replace(expenseId: string, values: NewExpenseRow, shares: Omit<ShareRow, 'expenseId'>[]) {
    return this.db.transaction(async (tx) => {
      const [expense] = await tx
        .update(schema.expense)
        .set(values)
        .where(eq(schema.expense.id, expenseId))
        .returning()
      if (!expense) throw new Error('Expense not found')
      await tx.delete(schema.expenseShare).where(eq(schema.expenseShare.expenseId, expenseId))
      const saved = await tx
        .insert(schema.expenseShare)
        .values(shares.map((s) => ({ ...s, expenseId })))
        .returning()
      return { expense, shares: saved }
    })
  }

  async delete(expenseId: string) {
    await this.db.delete(schema.expense).where(eq(schema.expense.id, expenseId))
  }

  async itemInTrip(itemId: string, tripId: string) {
    const [row] = await this.db
      .select({ id: schema.tripItem.id })
      .from(schema.tripItem)
      .where(and(eq(schema.tripItem.id, itemId), eq(schema.tripItem.tripId, tripId)))
      .limit(1)
    return Boolean(row)
  }

  async updateTripMoney(
    tripId: string,
    changes: { fxRates?: Record<string, string>; dailyBudgetMinor?: bigint | null },
  ) {
    await this.db.update(schema.trip).set(changes).where(eq(schema.trip.id, tripId))
  }

  async listContributions(tripId: string) {
    return this.db
      .select()
      .from(schema.tripPoolContribution)
      .where(eq(schema.tripPoolContribution.tripId, tripId))
      .orderBy(asc(schema.tripPoolContribution.date), asc(schema.tripPoolContribution.createdAt))
  }

  async findContribution(id: string) {
    const [row] = await this.db
      .select()
      .from(schema.tripPoolContribution)
      .where(eq(schema.tripPoolContribution.id, id))
      .limit(1)
    return row ?? null
  }

  async createContribution(values: NewContributionRow) {
    const [row] = await this.db.insert(schema.tripPoolContribution).values(values).returning()
    if (!row) throw new Error('Contribution insert returned nothing')
    return row
  }

  async updateContribution(id: string, values: NewContributionRow) {
    const [row] = await this.db
      .update(schema.tripPoolContribution)
      .set(values)
      .where(eq(schema.tripPoolContribution.id, id))
      .returning()
    if (!row) throw new Error('Contribution not found')
    return row
  }

  async deleteContribution(id: string) {
    await this.db.delete(schema.tripPoolContribution).where(eq(schema.tripPoolContribution.id, id))
  }

  async updatePoolMode(tripId: string, mode: 'actual' | 'proportional') {
    await this.db.update(schema.trip).set({ poolMode: mode }).where(eq(schema.trip.id, tripId))
  }
}
