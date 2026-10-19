/** Adds the dev-login accounts. Run after migrations; safe to repeat. */
import { createDb } from './client'
import { loadRootEnv, requireDatabaseUrl } from './env'
import { seedBase } from './seed-base'

loadRootEnv()

async function main() {
  const db = createDb(requireDatabaseUrl(), { max: 1 })
  await db.transaction(async (tx) => seedBase(tx))
  console.warn('Seeded dev-login accounts (owner, friend, waiting for approval).')
  await db.$client.end()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
