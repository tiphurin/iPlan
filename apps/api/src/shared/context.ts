import type { UserRole, UserStatus } from '@iplan/contracts'

/** What every request knows about the signed-in, approved user. */
export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
}

/** A signed-in account in any state, including one still waiting for approval. */
export interface SessionAccount extends SessionUser {
  status: UserStatus
  mustChangePassword?: boolean
}

export interface AppEnv {
  Variables: {
    /** Set only for approved (active) accounts; null otherwise. */
    user: SessionUser | null
    /** Set for every signed-in, non-suspended account. */
    account: SessionAccount | null
  }
}

export const isAdmin = (user: Pick<SessionUser, 'role'>) =>
  user.role === 'admin' || user.role === 'superadmin'

export const isSuperAdmin = (user: Pick<SessionUser, 'role'>) => user.role === 'superadmin'
