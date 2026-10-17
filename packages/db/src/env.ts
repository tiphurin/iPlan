import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Loads the monorepo root .env for CLI scripts (drizzle-kit, seed). Real env vars win. */
export function loadRootEnv(): void {
  const path = fileURLToPath(new URL('../../../.env', import.meta.url))
  if (existsSync(path)) process.loadEnvFile(path)
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.')
  return url
}
