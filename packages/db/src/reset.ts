/**
 * Wipes the database and rebuilds it: drop everything, run every migration,
 * add the dev-login accounts. Refuses to touch a non-local database unless
 * --allow-remote is passed, so it can't wipe Neon by accident.
 */
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDb } from './client'
import { loadRootEnv, requireDatabaseUrl } from './env'
import { seedBase } from './seed-base'

loadRootEnv()

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function isLocalDatabase(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

async function main() {
  const url = requireDatabaseUrl()
  if (!isLocalDatabase(url) && !process.argv.includes('--allow-remote')) {
    throw new Error('Refusing to reset a non-local database. Pass --allow-remote if you mean it.')
  }
  const db = createDb(url, { max: 1 })
  await db.execute(sql`drop schema if exists drizzle cascade`)
  await db.execute(sql`drop schema public cascade`)
  await db.execute(sql`create schema public`)
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)),
  })
  await db.transaction(async (tx) => seedBase(tx))
  console.warn('Database reset: schema rebuilt, dev-login accounts added. No trips yet.')
  await db.$client.end()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
