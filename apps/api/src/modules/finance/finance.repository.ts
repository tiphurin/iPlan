import { type Executor, schema } from '@iplan/db'
import { and, asc, between, eq, inArray } from 'drizzle-orm'

export type CategoryRow = typeof schema.financeCategory.$inferSelect
export type RuleRow = typeof schema.recurringRule.$inferSelect
export type OverrideRow = typeof schema.recurringOverride.$inferSelect
export type TransactionRow = typeof schema.financeTransaction.$inferSelect

type NewCategory = Omit<typeof schema.financeCategory.$inferInsert, 'id' | 'createdAt'>
type NewRule = Omit<typeof schema.recurringRule.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
type NewTransaction = Omit<
  typeof schema.financeTransaction.$inferInsert,
  'id' | 'createdAt' | 'updatedAt'
>

/** Everything here is scoped to one owner; services never cross users. */
export interface FinanceRepository {
  categories(ownerId: string): Promise<CategoryRow[]>
  /** Creates the built-ins; returns all of the owner's categories. */
  createCategories(rows: NewCategory[]): Promise<CategoryRow[]>
  /** Creates one category and returns it. */
  createCategory(row: NewCategory): Promise<CategoryRow>
  userExists(id: string): Promise<boolean>
  updateCategory(
    id: string,
    ownerId: string,
    changes: Partial<NewCategory>,
  ): Promise<CategoryRow | null>
  deleteCategory(id: string, ownerId: string): Promise<boolean>
  rules(ownerId: string): Promise<RuleRow[]>
  createRule(values: NewRule): Promise<RuleRow>
  updateRule(id: string, ownerId: string, changes: Partial<NewRule>): Promise<RuleRow | null>
  deleteRule(id: string, ownerId: string): Promise<boolean>
  overrides(ruleIds: string[]): Promise<OverrideRow[]>
  setOverride(row: OverrideRow): Promise<void>
  clearOverride(ruleId: string, month: string): Promise<void>
  transactions(ownerId: string, fromDate: string, toDate: string): Promise<TransactionRow[]>
  createTransaction(values: NewTransaction): Promise<TransactionRow>
  updateTransaction(
    id: string,
    ownerId: string,
    changes: Partial<NewTransaction>,
  ): Promise<TransactionRow | null>
  deleteTransaction(id: string, ownerId: string): Promise<boolean>
}

export class DrizzleFinanceRepository implements FinanceRepository {
  constructor(private readonly db: Executor) {}

  categories(ownerId: string) {
    return this.db
      .select()
      .from(schema.financeCategory)
      .where(eq(schema.financeCategory.ownerId, ownerId))
      .orderBy(asc(schema.financeCategory.kind), asc(schema.financeCategory.sortOrder))
  }

  async createCategories(rows: NewCategory[]) {
    if (rows.length === 0) return []
    // A parallel first visit may have created the built-ins already; keep theirs.
    await this.db.insert(schema.financeCategory).values(rows).onConflictDoNothing()
    const owner = rows[0]?.ownerId
    return owner ? this.categories(owner) : []
  }

  async createCategory(row: NewCategory) {
    const [created] = await this.db.insert(schema.financeCategory).values(row).returning()
    if (!created) throw new Error('Category insert returned nothing')
    return created
  }

  async userExists(id: string) {
    const rows = await this.db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, id))
    return rows.length > 0
  }

  async updateCategory(id: string, ownerId: string, changes: Partial<NewCategory>) {
    const [row] = await this.db
      .update(schema.financeCategory)
      .set(changes)
      .where(and(eq(schema.financeCategory.id, id), eq(schema.financeCategory.ownerId, ownerId)))
      .returning()
    return row ?? null
  }

  async deleteCategory(id: string, ownerId: string) {
    const rows = await this.db
      .delete(schema.financeCategory)
      .where(and(eq(schema.financeCategory.id, id), eq(schema.financeCategory.ownerId, ownerId)))
      .returning({ id: schema.financeCategory.id })
    return rows.length > 0
  }

  rules(ownerId: string) {
    return this.db
      .select()
      .from(schema.recurringRule)
      .where(eq(schema.recurringRule.ownerId, ownerId))
      .orderBy(
        asc(schema.recurringRule.kind),
        asc(schema.recurringRule.sortOrder),
        asc(schema.recurringRule.createdAt),
      )
  }

  async createRule(values: NewRule) {
    const [row] = await this.db.insert(schema.recurringRule).values(values).returning()
    if (!row) throw new Error('Rule insert returned nothing')
    return row
  }

  async updateRule(id: string, ownerId: string, changes: Partial<NewRule>) {
    const [row] = await this.db
      .update(schema.recurringRule)
      .set(changes)
      .where(and(eq(schema.recurringRule.id, id), eq(schema.recurringRule.ownerId, ownerId)))
      .returning()
    return row ?? null
  }

  async deleteRule(id: string, ownerId: string) {
    const rows = await this.db
      .delete(schema.recurringRule)
      .where(and(eq(schema.recurringRule.id, id), eq(schema.recurringRule.ownerId, ownerId)))
      .returning({ id: schema.recurringRule.id })
    return rows.length > 0
  }

  async overrides(ruleIds: string[]) {
    if (ruleIds.length === 0) return []
    return this.db
      .select()
      .from(schema.recurringOverride)
      .where(inArray(schema.recurringOverride.ruleId, ruleIds))
  }

  async setOverride(row: OverrideRow) {
    await this.db
      .insert(schema.recurringOverride)
      .values(row)
      .onConflictDoUpdate({
        target: [schema.recurringOverride.ruleId, schema.recurringOverride.month],
        set: { amountMinor: row.amountMinor, note: row.note },
      })
  }

  async clearOverride(ruleId: string, month: string) {
    await this.db
      .delete(schema.recurringOverride)
      .where(
        and(eq(schema.recurringOverride.ruleId, ruleId), eq(schema.recurringOverride.month, month)),
      )
  }

  transactions(ownerId: string, fromDate: string, toDate: string) {
    return this.db
      .select()
      .from(schema.financeTransaction)
      .where(
        and(
          eq(schema.financeTransaction.ownerId, ownerId),
          between(schema.financeTransaction.date, fromDate, toDate),
        ),
      )
      .orderBy(asc(schema.financeTransaction.date), asc(schema.financeTransaction.createdAt))
  }

  async createTransaction(values: NewTransaction) {
    const [row] = await this.db.insert(schema.financeTransaction).values(values).returning()
    if (!row) throw new Error('Transaction insert returned nothing')
    return row
  }

  async updateTransaction(id: string, ownerId: string, changes: Partial<NewTransaction>) {
    const [row] = await this.db
      .update(schema.financeTransaction)
      .set(changes)
      .where(
        and(eq(schema.financeTransaction.id, id), eq(schema.financeTransaction.ownerId, ownerId)),
      )
      .returning()
    return row ?? null
  }

  async deleteTransaction(id: string, ownerId: string) {
    const rows = await this.db
      .delete(schema.financeTransaction)
      .where(
        and(eq(schema.financeTransaction.id, id), eq(schema.financeTransaction.ownerId, ownerId)),
      )
      .returning({ id: schema.financeTransaction.id })
    return rows.length > 0
  }
}
