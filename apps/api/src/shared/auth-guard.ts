import type { Context } from 'hono'
import {
  type AppEnv,
  type SessionAccount,
  type SessionUser,
  isAdmin,
  isSuperAdmin,
} from './context'
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
  const account = c.get('account')
  if (account?.mustChangePassword) {
    throw new AppError('PASSWORD_CHANGE_REQUIRED', 403, 'Choose a new password first')
  }
  if (account) {
    throw new AppError('ACCOUNT_PENDING', 403, 'Waiting for an admin to approve this account')
  }
  throw unauthorized()
}

export function requireAdmin(c: Context<AppEnv>): SessionUser {
  const user = requireUser(c)
  if (!isAdmin(user)) throw forbidden('Admin only')
  return user
}

export function requireSuperAdmin(c: Context<AppEnv>): SessionUser {
  const user = requireUser(c)
  if (!isSuperAdmin(user)) throw forbidden('Super admin only')
  return user
}
