import { type Executor, schema } from '@iplan/db'
import { asc, count, eq, inArray } from 'drizzle-orm'

export type GroupRow = typeof schema.userGroup.$inferSelect & {
  features: string[]
  memberCount: number
}

export interface GroupFields {
  name: string
  description: string | null
}

export interface AccessRepository {
  /** Feature keys granted to the user through any of their groups. */
  featuresFor(userId: string): Promise<string[]>
  groups(): Promise<GroupRow[]>
  group(id: string): Promise<GroupRow | null>
  createGroup(fields: GroupFields, features: string[]): Promise<string>
  updateGroup(id: string, fields: Partial<GroupFields>, features?: string[]): Promise<void>
  deleteGroup(id: string): Promise<void>
  groupIdsFor(userIds: string[]): Promise<Map<string, string[]>>
  setUserGroups(userId: string, groupIds: string[]): Promise<void>
}

export class DrizzleAccessRepository implements AccessRepository {
  constructor(private readonly db: Executor) {}

  async featuresFor(userId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ key: schema.groupFeature.featureKey })
      .from(schema.groupFeature)
      .innerJoin(
        schema.userGroupMember,
        eq(schema.userGroupMember.groupId, schema.groupFeature.groupId),
      )
      .where(eq(schema.userGroupMember.userId, userId))
    return rows.map((r) => r.key)
  }

  async groups(): Promise<GroupRow[]> {
    const [groups, features, members] = await Promise.all([
      this.db.select().from(schema.userGroup).orderBy(asc(schema.userGroup.name)),
      this.db.select().from(schema.groupFeature),
      this.db
        .select({ groupId: schema.userGroupMember.groupId, value: count() })
        .from(schema.userGroupMember)
        .groupBy(schema.userGroupMember.groupId),
    ])
    return groups.map((g) => ({
      ...g,
      features: features.filter((f) => f.groupId === g.id).map((f) => f.featureKey),
      memberCount: Number(members.find((m) => m.groupId === g.id)?.value ?? 0),
    }))
  }

  async group(id: string): Promise<GroupRow | null> {
    return (await this.groups()).find((g) => g.id === id) ?? null
  }

  async createGroup(fields: GroupFields, features: string[]): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.userGroup)
        .values(fields)
        .returning({ id: schema.userGroup.id })
      if (!row) throw new Error('Insert returned no row')
      if (features.length > 0) {
        await tx
          .insert(schema.groupFeature)
          .values(features.map((featureKey) => ({ groupId: row.id, featureKey })))
      }
      return row.id
    })
  }

  async updateGroup(id: string, fields: Partial<GroupFields>, features?: string[]) {
    await this.db.transaction(async (tx) => {
      if (Object.keys(fields).length > 0) {
        await tx.update(schema.userGroup).set(fields).where(eq(schema.userGroup.id, id))
      }
      if (features) {
        await tx.delete(schema.groupFeature).where(eq(schema.groupFeature.groupId, id))
        if (features.length > 0) {
          await tx
            .insert(schema.groupFeature)
            .values(features.map((featureKey) => ({ groupId: id, featureKey })))
        }
      }
    })
  }

  async deleteGroup(id: string) {
    await this.db.delete(schema.userGroup).where(eq(schema.userGroup.id, id))
  }

  async groupIdsFor(userIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>(userIds.map((id) => [id, []]))
    if (userIds.length === 0) return result
    const rows = await this.db
      .select()
      .from(schema.userGroupMember)
      .where(inArray(schema.userGroupMember.userId, userIds))
    for (const row of rows) result.get(row.userId)?.push(row.groupId)
    return result
  }

  async setUserGroups(userId: string, groupIds: string[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(schema.userGroupMember).where(eq(schema.userGroupMember.userId, userId))
      if (groupIds.length > 0) {
        await tx
          .insert(schema.userGroupMember)
          .values(groupIds.map((groupId) => ({ groupId, userId })))
      }
    })
  }
}
