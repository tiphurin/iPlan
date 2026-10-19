/**
 * Base data every environment needs locally: the dev-login accounts in each
 * approval state. Groups and features come from migration 0006.
 */
import { eq, inArray } from 'drizzle-orm'
import type { Executor } from './client'
import * as schema from './schema'

/** Fictional accounts for the local "Dev login" buttons. */
export const DEV_USERS = [
  {
    id: 'demo-owner',
    name: 'Demo Owner',
    email: 'dev@iplan.local',
    role: 'admin',
    status: 'active',
    group: 'Full access',
  },
  {
    id: 'demo-friend',
    name: 'Demo Friend',
    email: 'friend@iplan.local',
    role: 'user',
    status: 'active',
    group: 'Travelers',
  },
  {
    id: 'demo-waiting',
    name: 'New Sign-up',
    email: 'waiting@iplan.local',
    role: 'user',
    status: 'pending',
    group: null,
  },
] as const

export async function groupIdsByName(db: Executor): Promise<Map<string, string>> {
  const rows = await db.select().from(schema.userGroup)
  return new Map(rows.map((g) => [g.name, g.id]))
}

/** Puts a user into exactly the named groups (unknown names are ignored). */
export async function setGroups(db: Executor, userId: string, groupNames: readonly string[]) {
  const groups = await groupIdsByName(db)
  const ids = groupNames.flatMap((name) => groups.get(name) ?? [])
  await db.delete(schema.userGroupMember).where(eq(schema.userGroupMember.userId, userId))
  if (ids.length > 0) {
    await db.insert(schema.userGroupMember).values(ids.map((groupId) => ({ groupId, userId })))
  }
}

export async function seedBase(db: Executor): Promise<void> {
  for (const { group, ...u } of DEV_USERS) {
    await db
      .insert(schema.user)
      .values({ ...u, emailVerified: true })
      .onConflictDoUpdate({
        target: schema.user.id,
        set: { name: u.name, email: u.email, role: u.role, status: u.status },
      })
    await setGroups(db, u.id, group ? [group] : [])
  }
}

export async function devUserIds(db: Executor): Promise<string[]> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(
      inArray(
        schema.user.id,
        DEV_USERS.map((u) => u.id),
      ),
    )
  return rows.map((r) => r.id)
}
