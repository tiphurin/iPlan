import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

export type Database = ReturnType<typeof createDb>

/**
 * One pool per process. Serverless functions keep the pool small; Neon's pooled
 * connection string (PgBouncer) handles fan-out in production.
 */
export function createDb(databaseUrl: string, options: { max?: number } = {}) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: options.max ?? 5 })
  return drizzle(pool, { schema })
}

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
/** A database handle or an open transaction; repositories accept either. */
export type Executor = Database | Transaction
