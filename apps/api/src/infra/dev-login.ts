import { AppError } from '../shared/errors'
import type { Auth } from './auth'

/** Only these fictional seed users can use dev login. */
export const DEV_LOGIN_EMAILS = ['dev@iplan.local', 'friend@iplan.local'] as const
export type DevLoginEmail = (typeof DEV_LOGIN_EMAILS)[number]

const DEV_PASSWORD = 'iplan-dev-login-only'

/**
 * Signs in as a seeded demo user without Google. Gives the user a password
 * credential on first use, then delegates to Better Auth so the session cookie
 * is exactly what a real sign-in produces. Never enabled in production.
 */
export async function devLogin(auth: Auth, email: DevLoginEmail): Promise<Response> {
  const ctx = await auth.$context
  const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true })
  if (!found) {
    throw new AppError('DEMO_DATA_MISSING', 409, 'Demo user missing; run yarn db:seed')
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
