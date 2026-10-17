/**
 * Resets the fictional demo data: two users and the "Seoul (demo)" trip.
 * Safe to run repeatedly; it only touches rows with the demo ids.
 */
import { localDateKey } from '@iplan/core'
import { eq, sql } from 'drizzle-orm'
import { createDb } from './client'
import { DEMO_USERS, buildDemoTrip } from './demo'
import { loadRootEnv, requireDatabaseUrl } from './env'
import * as schema from './schema'

loadRootEnv()

async function main() {
  const db = createDb(requireDatabaseUrl(), { max: 1 })
  const now = new Date()
  const demo = buildDemoTrip(localDateKey(now, 'Asia/Bangkok'))
  const [owner, friend] = DEMO_USERS

  await db.transaction(async (tx) => {
    for (const u of DEMO_USERS) {
      await tx
        .insert(schema.user)
        .values({ ...u, emailVerified: true })
        .onConflictDoUpdate({
          target: schema.user.id,
          set: { name: u.name, email: u.email, role: u.role },
        })
    }

    await tx.delete(schema.trip).where(eq(schema.trip.id, demo.trip.id))
    await tx.insert(schema.trip).values({ ...demo.trip, createdBy: owner.id })
    await tx.insert(schema.tripMember).values([
      { tripId: demo.trip.id, userId: owner.id, role: 'owner' },
      { tripId: demo.trip.id, userId: friend.id, role: 'editor' },
    ])

    const items = await tx
      .insert(schema.tripItem)
      .values(demo.items.map((item) => ({ ...item, tripId: demo.trip.id })))
      .returning({ id: schema.tripItem.id, startsAt: schema.tripItem.startsAt })

    // Check in to finished items with a little drift so late/early shows up.
    const drift = [3, -2, 12, 0, 7, -6]
    const done = items.filter((item) => item.startsAt.getTime() < now.getTime())
    if (done.length > 0) {
      await tx.insert(schema.tripItemCheckIn).values(
        done.map((item, index) => ({
          itemId: item.id,
          userId: owner.id,
          checkedInAt: new Date(
            item.startsAt.getTime() + (drift[index % drift.length] ?? 0) * 60_000,
          ),
        })),
      )
    }
  })

  const [{ count }] = (
    await db.execute<{ count: number }>(
      sql`select count(*)::int as count from ${schema.tripItem} where trip_id = ${demo.trip.id}`,
    )
  ).rows as [{ count: number }]
  console.warn(
    `Seeded "${demo.trip.name}" (${demo.trip.startDate} → ${demo.trip.endDate}) with ${count} items.`,
  )
  await db.$client.end()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
