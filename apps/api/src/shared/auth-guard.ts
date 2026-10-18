import type { Context } from 'hono'
import type { AppEnv, SessionUser } from './context'
import { forbidden, unauthorized } from './errors'

export function requireUser(c: Context<AppEnv>): SessionUser {
  const user = c.get('user')
  if (!user) throw unauthorized()
  return user
}

export function requireAdmin(c: Context<AppEnv>): SessionUser {
  const user = requireUser(c)
  if (user.role !== 'admin') throw forbidden('Admin only')
  return user
}
