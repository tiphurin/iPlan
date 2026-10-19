/**
 * Loads every packages/db/seed/private/*.json (gitignored) into the database:
 * creates or updates the people by email (approved, in their groups) and
 * replaces the trip with the file's id. When those people later sign in with
 * Google using the same email, they land in these accounts.
 */
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseMoney } from '@iplan/core'
import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { loadRootEnv, requireDatabaseUrl } from './env'
import { type PrivateSeedFile, buildPrivateItems } from './private-seed'
import * as schema from './schema'
import { setGroups } from './seed-base'

loadRootEnv()

const DIR = fileURLToPath(new URL('../seed/private/', import.meta.url))

async function main() {
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : []
  if (files.length === 0) {
    console.warn(`No private seed files in ${DIR}. Nothing to do.`)
    return
  }
  const db = createDb(requireDatabaseUrl(), { max: 1 })
  for (const name of files) {
    const file = JSON.parse(readFileSync(DIR + name, 'utf8')) as PrivateSeedFile
    const items = buildPrivateItems(file)
    await db.transaction(async (tx) => {
      const ids = new Map<string, string>()
      for (const person of file.users) {
        const email = person.email.trim().toLowerCase()
        const [existing] = await tx
          .select({ id: schema.user.id })
          .from(schema.user)
          .where(eq(schema.user.email, email))
          .limit(1)
        const id = existing?.id ?? randomUUID()
        const fields = {
          name: person.name,
          status: 'active',
          ...(person.admin && { role: 'admin' }),
        }
        if (existing) {
          await tx.update(schema.user).set(fields).where(eq(schema.user.id, id))
        } else {
          await tx.insert(schema.user).values({ id, email, emailVerified: true, ...fields })
        }
        await setGroups(tx, id, person.groups ?? ['Full access'])
        ids.set(person.key, id)
      }
      const userId = (key: string) => {
        const id = ids.get(key)
        if (!id) throw new Error(`${name}: unknown user key "${key}"`)
        return id
      }

      const { trip } = file
      await tx.delete(schema.trip).where(eq(schema.trip.id, trip.id))
      await tx.insert(schema.trip).values({
        id: trip.id,
        name: trip.name,
        destination: trip.destination ?? null,
        startDate: trip.startDate,
        endDate: trip.endDate,
        homeTimeZone: trip.homeTimeZone,
        baseCurrency: trip.baseCurrency,
        fxRates: trip.fxRates ?? {},
        dailyBudgetMinor: trip.dailyBudget
          ? parseMoney(trip.dailyBudget, trip.baseCurrency).amount
          : null,
        createdBy: userId(trip.owner),
      })
      await tx.insert(schema.tripMember).values([
        { tripId: trip.id, userId: userId(trip.owner), role: 'owner' as const },
        ...Object.entries(trip.members ?? {}).map(([key, role]) => ({
          tripId: trip.id,
          userId: userId(key),
          role,
        })),
      ])
      if (items.length > 0) {
        await tx.insert(schema.tripItem).values(items.map((i) => ({ ...i, tripId: trip.id })))
      }
      if (file.checklist?.length) {
        await tx.insert(schema.checklistItem).values(
          file.checklist.map((c, sortOrder) => ({
            tripId: trip.id,
            groupKey: c.group,
            title: c.title,
            sortOrder,
          })),
        )
      }
      if (file.infoCards?.length) {
        await tx
          .insert(schema.infoCard)
          .values(file.infoCards.map((c, sortOrder) => ({ ...c, tripId: trip.id, sortOrder })))
      }
    })
    console.warn(`Loaded ${name}: "${file.trip.name}" with ${items.length} items.`)
  }
  await db.$client.end()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
