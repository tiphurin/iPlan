/** What every request knows about the signed-in user (null when signed out). */
export interface SessionUser {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
}

export interface AppEnv {
  Variables: {
    user: SessionUser | null
  }
}
