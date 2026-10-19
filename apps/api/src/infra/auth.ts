import { type Database, schema } from '@iplan/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins/admin'
import type { ApiEnv } from '../env'

/**
 * During local development the app is also opened from a phone on the same
 * Wi-Fi (http://192.168.x.x:3000). Trust such private-network origins, but
 * only outside production.
 */
export function isPrivateDevOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if (url.protocol !== 'http:') return false
  const host = url.hostname
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)
  )
}

export function createAuth(db: Database, env: ApiEnv) {
  return betterAuth({
    baseURL: env.authUrl,
    basePath: '/api/auth',
    secret: env.authSecret,
    trustedOrigins: env.production
      ? [env.authUrl]
      : (request) => {
          const origin = request?.headers.get('origin')
          return [env.authUrl, isPrivateDevOrigin(origin) ? origin : null]
        },
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
      // Off on purpose: every request re-reads the session, so suspending a user
      // or signing them out takes effect immediately instead of after the cache expires.
      cookieCache: { enabled: false },
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
    banned?: boolean | null | undefined
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
