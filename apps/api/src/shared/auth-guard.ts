import type { Context } from 'hono'
import type { AppEnv, SessionAccount, SessionUser } from './context'
import { AppError, forbidden, unauthorized } from './errors'

/** Any signed-in account, approved or not. Only /me uses this. */
export function requireAccount(c: Context<AppEnv>): SessionAccount {
  const account = c.get('account')
  if (!account) throw unauthorized()
  return account
}

/** A signed-in account an admin has approved. */
export function requireUser(c: Context<AppEnv>): SessionUser {
  const user = c.get('user')
  if (user) return user
  if (c.get('account')) {
    throw new AppError('ACCOUNT_PENDING', 403, 'Waiting for an admin to approve this account')
  }
  throw unauthorized()
}

export function requireAdmin(c: Context<AppEnv>): SessionUser {
  const user = requireUser(c)
  if (user.role !== 'admin') throw forbidden('Admin only')
  return user
}
