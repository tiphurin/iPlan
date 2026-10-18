import { z } from 'zod'

const flag = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1')

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DEV_LOGIN_ENABLED: flag,
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export interface ApiEnv {
  databaseUrl: string
  authSecret: string
  authUrl: string
  google: { clientId: string; clientSecret: string } | null
  devLoginEnabled: boolean
  production: boolean
}

export function readEnv(source: Record<string, string | undefined> = process.env): ApiEnv {
  const env = EnvSchema.parse(source)
  const production = env.NODE_ENV === 'production'
  if (production && env.DEV_LOGIN_ENABLED) {
    throw new Error('DEV_LOGIN_ENABLED must be false in production')
  }
  return {
    databaseUrl: env.DATABASE_URL,
    authSecret: env.BETTER_AUTH_SECRET,
    authUrl: env.BETTER_AUTH_URL,
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : null,
    devLoginEnabled: env.DEV_LOGIN_ENABLED,
    production,
  }
}
