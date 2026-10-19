/**
 * Resets the fictional demo data: two users and the "Seoul (demo)" trip.
 * Safe to run repeatedly; it only touches rows with the demo ids.
 */
import { convertMoney, localDateKey, money, parseMoney, splitEqual, splitExact } from '@iplan/core'
import { eq, sql } from 'drizzle-orm'
import { createDb } from './client'
import {
  DEMO_CHECKLIST,
  DEMO_DAILY_BUDGET_MINOR,
  DEMO_EXPENSES,
  DEMO_FX_RATES,
  DEMO_INFO_CARDS,
  DEMO_USERS,
  addDays,
  buildDemoTrip,
} from './demo'
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
    await tx.insert(schema.trip).values({
      ...demo.trip,
      fxRates: DEMO_FX_RATES,
      dailyBudgetMinor: DEMO_DAILY_BUDGET_MINOR,
      createdBy: owner.id,
    })
    await tx.insert(schema.tripMember).values([
      { tripId: demo.trip.id, userId: owner.id, role: 'owner' },
      { tripId: demo.trip.id, userId: friend.id, role: 'editor' },
    ])

    const items = await tx
      .insert(schema.tripItem)
      .values(demo.items.map((item) => ({ ...item, tripId: demo.trip.id })))
      .returning({ id: schema.tripItem.id, startsAt: schema.tripItem.startsAt })

    const checklist = await tx
      .insert(schema.checklistItem)
      .values(
        DEMO_CHECKLIST.map(({ groupKey, title }, i) => ({
          tripId: demo.trip.id,
          groupKey,
          title,
          sortOrder: i,
        })),
      )
      .returning({ id: schema.checklistItem.id })
    const ticked = checklist.filter((_, i) => DEMO_CHECKLIST[i]?.ticked)
    if (ticked.length > 0) {
      await tx
        .insert(schema.checklistTick)
        .values(ticked.map((c, i) => ({ itemId: c.id, userId: i % 2 ? friend.id : owner.id })))
    }
    await tx
      .insert(schema.infoCard)
      .values(DEMO_INFO_CARDS.map((card, i) => ({ ...card, tripId: demo.trip.id, sortOrder: i })))

    const ids = { owner: owner.id, friend: friend.id, pool: 'pool' }
    for (const e of DEMO_EXPENSES) {
      const amount = parseMoney(e.amount, e.currency).amount
      const rate = e.currency === 'THB' ? '1' : DEMO_FX_RATES.KRW
      const shares =
        e.split === 'equal'
          ? splitEqual(amount, [owner.id, friend.id])
          : splitExact(amount, {
              [owner.id]: parseMoney(e.split.owner, e.currency).amount,
              [friend.id]: parseMoney(e.split.friend, e.currency).amount,
            })
      const [row] = await tx
        .insert(schema.expense)
        .values({
          tripId: demo.trip.id,
          dayDate: addDays(demo.trip.startDate, e.day),
          title: e.title,
          category: e.category,
          amountMinor: amount,
          currency: e.currency,
          fxRate: rate,
          baseAmountMinor: convertMoney(money(amount, e.currency), {
            from: e.currency,
            to: 'THB',
            rate,
          }).amount,
          paidBy: ids[e.paidBy],
          splitMode: e.split === 'equal' ? 'equal' : 'exact',
          createdBy: owner.id,
        })
        .returning({ id: schema.expense.id })
      if (!row) continue
      await tx.insert(schema.expenseShare).values(
        Object.entries(shares)
          .filter(([, value]) => e.split === 'equal' || value > 0n)
          .map(([userId, amountMinor]) => ({ expenseId: row.id, userId, amountMinor })),
      )
    }

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
