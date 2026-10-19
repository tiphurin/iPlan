import { z } from 'zod'

/**
 * Every feature an admin can grant to a user group. Adding a feature means adding
 * its key here, a manifest in apps/web/features and a guard on its API paths.
 */
export const FEATURE_KEYS = ['trips', 'finance', 'shared'] as const
export const FeatureKey = z.enum(FEATURE_KEYS)
export type FeatureKey = z.infer<typeof FeatureKey>

/** pending: signed in with Google but not yet approved by an admin. */
export const UserStatus = z.enum(['pending', 'active'])
export type UserStatus = z.infer<typeof UserStatus>
