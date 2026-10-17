import { type Database, schema } from '@iplan/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins/admin'
import type { ApiEnv } from '../env'

export function createAuth(db: Database, env: ApiEnv) {
  return betterAuth({
    baseURL: env.authUrl,
    basePath: '/api/auth',
    secret: env.authSecret,
    trustedOrigins: [env.authUrl],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    // Password sign-in exists only so the local "Dev login" button can work.
    emailAndPassword: { enabled: env.devLoginEnabled, disableSignUp: true },
    socialProviders: env.google
      ? { google: { clientId: env.google.clientId, clientSecret: env.google.clientSecret } }
      : {},
    user: {
      additionalFields: {
        locale: { type: 'string', defaultValue: 'th', input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      useSecureCookies: env.production,
    },
    telemetry: { enabled: false },
    plugins: [admin()],
  })
}

export type Auth = ReturnType<typeof createAuth>

/** The slice of Better Auth the HTTP layer needs; tests pass a fake. */
export interface AuthGateway {
  handler(request: Request): Promise<Response>
  getSessionUser(headers: Headers): Promise<{
    id: string
    name: string
    email: string
    role?: string | null | undefined
  } | null>
}

export function authGateway(auth: Auth): AuthGateway {
  return {
    handler: (request) => auth.handler(request),
    getSessionUser: async (headers) => {
      const result = await auth.api.getSession({ headers })
      return result?.user ?? null
    },
  }
}
