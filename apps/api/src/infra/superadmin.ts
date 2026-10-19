import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { type Database, schema } from '@iplan/db'
import { eq } from 'drizzle-orm'
import type { Auth } from './auth'

/** The single built-in admin. Signs in with username "admin" instead of Google. */
export const SUPERADMIN = {
  id: 'superadmin',
  username: 'admin',
  email: 'admin@iplan.local',
  name: 'Admin',
} as const

/**
 * Remembers which SUPERADMIN_PASSWORD was applied, keyed with the auth secret so the
 * stored value can't be brute-forced offline into the bootstrap password.
 */
export const fingerprint = (password: string, authSecret: string) =>
  `hmac:${createHmac('sha256', authSecret).update(password).digest('hex')}`

/** What older versions stored: plain SHA-256 of the password. */
const legacyFingerprint = (password: string) => createHash('sha256').update(password).digest('hex')

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

/**
 * Creates the built-in admin from SUPERADMIN_PASSWORD, or resets its password when
 * that variable changes (the way back in after a forgotten password). Either way the
 * password must be changed at the next sign-in. Safe to run from several cold starts
 * at once: the insert ignores a row another instance just created.
 */
export async function ensureSuperAdmin(
  auth: Auth,
  db: Database,
  password: string | null,
  authSecret: string,
) {
  if (!password) return
  const secretHash = fingerprint(password, authSecret)
  const [row] = await db
    .select({ hash: schema.user.bootstrapSecretHash })
    .from(schema.user)
    .where(eq(schema.user.id, SUPERADMIN.id))
  if (row?.hash && same(row.hash, secretHash)) return
  if (row?.hash && same(row.hash, legacyFingerprint(password))) {
    // Same variable as before, stored the old way: upgrade the record, keep the password.
    await db
      .update(schema.user)
      .set({ bootstrapSecretHash: secretHash })
      .where(eq(schema.user.id, SUPERADMIN.id))
    return
  }
  const ctx = await auth.$context
  // Hashed directly: the bootstrap password skips the 8-character rule on purpose.
  const hashed = await ctx.password.hash(password)
  if (!row) {
    const created = await db
      .insert(schema.user)
      .values({
        id: SUPERADMIN.id,
        name: SUPERADMIN.name,
        email: SUPERADMIN.email,
        emailVerified: true,
        role: 'superadmin',
        status: 'active',
        mustChangePassword: true,
        bootstrapSecretHash: secretHash,
      })
      .onConflictDoNothing()
      .returning({ id: schema.user.id })
    // Another instance won the race and links the password itself.
    if (created.length === 0) return
    await ctx.internalAdapter.linkAccount({
      userId: SUPERADMIN.id,
      providerId: 'credential',
      accountId: SUPERADMIN.id,
      password: hashed,
    })
    return
  }
  const accounts = await ctx.internalAdapter.findAccounts(SUPERADMIN.id)
  if (accounts.some((a) => a.providerId === 'credential')) {
    await ctx.internalAdapter.updatePassword(SUPERADMIN.id, hashed)
  } else {
    await ctx.internalAdapter.linkAccount({
      userId: SUPERADMIN.id,
      providerId: 'credential',
      accountId: SUPERADMIN.id,
      password: hashed,
    })
  }
  await db
    .update(schema.user)
    .set({
      role: 'superadmin',
      status: 'active',
      banned: false,
      mustChangePassword: true,
      bootstrapSecretHash: secretHash,
    })
    .where(eq(schema.user.id, SUPERADMIN.id))
}
