/**
 * Optional fictional demo data for the /showcase page: the "Seoul (demo)" trip and
 * a year of personal finance for the dev-login owner. Never needed for real use.
 * Safe to run repeatedly; it only touches rows with the demo ids.
 */
import { convertMoney, localDateKey, money, parseMoney, splitEqual, splitExact } from '@iplan/core'
import { eq, sql } from 'drizzle-orm'
import { createDb } from './client'
import {
  DEMO_CHECKLIST,
  DEMO_DAILY_BUDGET_MINOR,
  DEMO_EXPENSES,
  DEMO_FINANCE_CATEGORIES,
  DEMO_RULES,
  DEMO_TRANSACTIONS,
  addMonthsKey,
  DEMO_FX_RATES,
  DEMO_INFO_CARDS,
  addDays,
  buildDemoTrip,
} from './demo'
import { loadRootEnv, requireDatabaseUrl } from './env'
import { DEV_USERS, seedBase } from './seed-base'
import * as schema from './schema'

loadRootEnv()

async function main() {
  const db = createDb(requireDatabaseUrl(), { max: 1 })
  const now = new Date()
  const demo = buildDemoTrip(localDateKey(now, 'Asia/Bangkok'))
  const [owner, friend] = DEV_USERS

  await db.transaction(async (tx) => {
    await seedBase(tx)

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

    // Both put ฿1,000 into the pool first: the pool only spends money it holds.
    await tx.insert(schema.tripPoolContribution).values(
      [owner.id, friend.id].map((userId) => ({
        tripId: demo.trip.id,
        userId,
        amountMinor: 100_000n,
        currency: 'THB',
        fxRate: '1',
        baseAmountMinor: 100_000n,
        date: demo.trip.startDate,
        createdBy: owner.id,
      })),
    )
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

    // Personal finance for the demo owner: reset and rebuild.
    await tx.delete(schema.financeCategory).where(eq(schema.financeCategory.ownerId, owner.id))
    await tx.delete(schema.recurringRule).where(eq(schema.recurringRule.ownerId, owner.id))
    await tx
      .delete(schema.financeTransaction)
      .where(eq(schema.financeTransaction.ownerId, owner.id))
    const categories = await tx
      .insert(schema.financeCategory)
      .values(
        DEMO_FINANCE_CATEGORIES.map((c, i) => ({
          ownerId: owner.id,
          kind: c.kind,
          name: `default:${c.key}`,
          color: c.color,
          budgetMinor: 'budget' in c ? c.budget : null,
          sortOrder: i,
        })),
      )
      .returning({ id: schema.financeCategory.id, name: schema.financeCategory.name })
    const categoryId = (key?: string) =>
      categories.find((c) => c.name === `default:${key}`)?.id ?? null
    const month = localDateKey(now, 'Asia/Bangkok').slice(0, 7)
    const rules = await tx
      .insert(schema.recurringRule)
      .values(
        DEMO_RULES.map((r, i) => ({
          ownerId: owner.id,
          kind: r.kind,
          name: r.name,
          amountMinor: parseMoney(r.amount, 'THB').amount,
          startMonth: addMonthsKey(month, -r.from),
          categoryId: categoryId('category' in r ? r.category : undefined),
          sortOrder: i,
        })),
      )
      .returning({ id: schema.recurringRule.id, name: schema.recurringRule.name })
    const salary = rules.find((r) => r.name === 'Salary')
    if (salary) {
      // A bonus last month shows how one month can be adjusted.
      await tx.insert(schema.recurringOverride).values({
        ruleId: salary.id,
        month: addMonthsKey(month, -1),
        amountMinor: parseMoney('67500', 'THB').amount,
        note: 'Half-year bonus',
      })
    }
    await tx.insert(schema.financeTransaction).values(
      DEMO_TRANSACTIONS.map((t) => ({
        ownerId: owner.id,
        kind: t.kind,
        title: t.title,
        amountMinor: parseMoney(t.amount, 'THB').amount,
        date: `${addMonthsKey(month, -t.ago)}-${String(t.day).padStart(2, '0')}`,
        categoryId: categoryId(t.category),
      })),
    )

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
