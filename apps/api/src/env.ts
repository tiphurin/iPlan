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
  /** Comma-separated. These Google accounts become active admins on first sign-in. */
  ADMIN_EMAILS: z.string().default(''),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('.data/uploads'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: flag,
})

export interface ApiEnv {
  databaseUrl: string
  authSecret: string
  authUrl: string
  google: { clientId: string; clientSecret: string } | null
  devLoginEnabled: boolean
  /** Lower-cased. */
  adminEmails: string[]
  production: boolean
  storage:
    | { driver: 'local'; localDir: string }
    | {
        driver: 's3'
        s3: {
          endpoint: string
          region: string
          bucket: string
          accessKeyId: string
          secretAccessKey: string
          forcePathStyle: boolean
        }
      }
}

export function readEnv(source: Record<string, string | undefined> = process.env): ApiEnv {
  const env = EnvSchema.parse(source)
  const production = env.NODE_ENV === 'production'
  if (production && env.DEV_LOGIN_ENABLED) {
    throw new Error('DEV_LOGIN_ENABLED must be false in production')
  }
  let storage: ApiEnv['storage'] = { driver: 'local', localDir: env.LOCAL_STORAGE_DIR }
  if (env.STORAGE_DRIVER === 's3') {
    const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env
    if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new Error(
        'STORAGE_DRIVER=s3 needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY',
      )
    }
    storage = {
      driver: 's3',
      s3: {
        endpoint: S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: S3_BUCKET,
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
      },
    }
  } else if (production) {
    throw new Error('Use STORAGE_DRIVER=s3 in production (local disk is not durable on Vercel)')
  }
  return {
    storage,
    databaseUrl: env.DATABASE_URL,
    authSecret: env.BETTER_AUTH_SECRET,
    authUrl: env.BETTER_AUTH_URL,
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : null,
    devLoginEnabled: env.DEV_LOGIN_ENABLED,
    adminEmails: parseEmailList(env.ADMIN_EMAILS),
    production,
  }
}

export function parseEmailList(value: string): string[] {
  return value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes('@'))
}
