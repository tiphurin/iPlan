import { type Executor, schema } from '@iplan/db'
import { and, eq } from 'drizzle-orm'

export type UserRow = typeof schema.user.$inferSelect
export type UserChanges = Partial<
  Pick<UserRow, 'name' | 'locale' | 'avatarKey' | 'nickname' | 'mustChangePassword'>
>

export interface MeRepository {
  findById(id: string): Promise<UserRow | null>
  update(id: string, changes: UserChanges): Promise<UserRow | null>
  /** Has a password sign-in (the built-in admin, or a dev-login account). */
  hasPassword(id: string): Promise<boolean>
}

export class DrizzleMeRepository implements MeRepository {
  constructor(private readonly db: Executor) {}

  async findById(id: string): Promise<UserRow | null> {
    const [row] = await this.db.select().from(schema.user).where(eq(schema.user.id, id)).limit(1)
    return row ?? null
  }

  async hasPassword(id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(and(eq(schema.account.userId, id), eq(schema.account.providerId, 'credential')))
      .limit(1)
    return Boolean(row)
  }

  async update(id: string, changes: UserChanges): Promise<UserRow | null> {
    const [row] = await this.db
      .update(schema.user)
      .set(changes)
      .where(eq(schema.user.id, id))
      .returning()
    return row ?? null
  }
}
