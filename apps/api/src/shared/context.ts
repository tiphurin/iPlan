import type { UserStatus } from '@iplan/contracts'

/** What every request knows about the signed-in, approved user. */
export interface SessionUser {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
}

/** A signed-in account in any state, including one still waiting for approval. */
export interface SessionAccount extends SessionUser {
  status: UserStatus
}

export interface AppEnv {
  Variables: {
    /** Set only for approved (active) accounts; null otherwise. */
    user: SessionUser | null
    /** Set for every signed-in, non-suspended account. */
    account: SessionAccount | null
  }
}
