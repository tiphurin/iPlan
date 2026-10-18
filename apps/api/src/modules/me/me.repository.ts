import { type Executor, schema } from '@iplan/db'
import { eq } from 'drizzle-orm'

export type UserRow = typeof schema.user.$inferSelect

export interface MeRepository {
  findById(id: string): Promise<UserRow | null>
  update(id: string, changes: Partial<Pick<UserRow, 'name' | 'locale'>>): Promise<UserRow | null>
}

export class DrizzleMeRepository implements MeRepository {
  constructor(private readonly db: Executor) {}

  async findById(id: string): Promise<UserRow | null> {
    const [row] = await this.db.select().from(schema.user).where(eq(schema.user.id, id)).limit(1)
    return row ?? null
  }

  async update(
    id: string,
    changes: Partial<Pick<UserRow, 'name' | 'locale'>>,
  ): Promise<UserRow | null> {
    const [row] = await this.db
      .update(schema.user)
      .set(changes)
      .where(eq(schema.user.id, id))
      .returning()
    return row ?? null
  }
}
