import { type Database, schema } from '@iplan/db'
import { asc } from 'drizzle-orm'
import { AppError } from '../shared/errors'
import type { Auth } from './auth'

const DEV_PASSWORD = 'iplan-dev-login-only'

export interface DevUser {
  name: string
  email: string
  role: string
  status: string
}

/** Everyone in the local database, for the dev-login picker. */
export async function devUsers(db: Database): Promise<DevUser[]> {
  return db
    .select({
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      status: schema.user.status,
    })
    .from(schema.user)
    .orderBy(asc(schema.user.createdAt))
    .limit(20)
}

/**
 * Signs in as any existing user without Google. Gives the user a password
 * credential on first use, then delegates to Better Auth so the session cookie
 * is exactly what a real sign-in produces. Never enabled in production.
 */
export async function devLogin(auth: Auth, email: string): Promise<Response> {
  const ctx = await auth.$context
  const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true })
  if (!found) {
    throw new AppError('DEMO_DATA_MISSING', 409, 'No such user; run yarn db:seed')
  }
  if (!found.accounts.some((account) => account.providerId === 'credential')) {
    await ctx.internalAdapter.linkAccount({
      userId: found.user.id,
      providerId: 'credential',
      accountId: found.user.id,
      password: await ctx.password.hash(DEV_PASSWORD),
    })
  }
  return auth.api.signInEmail({ body: { email, password: DEV_PASSWORD }, asResponse: true })
}
