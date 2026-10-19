import { z } from 'zod'
import { FeatureKey, UserStatus } from './features'

export const Locale = z.enum(['th', 'en'])
export type Locale = z.infer<typeof Locale>

/** superadmin: the single built-in "admin" account; admin: appointed by the superadmin. */
export const UserRole = z.enum(['user', 'admin', 'superadmin'])
export type UserRole = z.infer<typeof UserRole>

export const MeDto = z.object({
  id: z.string(),
  name: z.string(),
  nickname: z.string().nullable(),
  email: z.string(),
  image: z.string().nullable(),
  role: UserRole,
  status: UserStatus,
  /** Features this user may open; drives the tab bar and dashboard. */
  features: z.array(FeatureKey),
  locale: Locale,
  /** Signs in with a password (the built-in admin account) rather than Google. */
  hasPassword: z.boolean(),
  /** First sign-in with the bootstrap password: must pick a new one before anything else. */
  mustChangePassword: z.boolean(),
  createdAt: z.iso.datetime(),
})
export type MeDto = z.infer<typeof MeDto>

export const UpdateMeInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  locale: Locale.optional(),
  /** Trimmed; empty clears it. Control characters are rejected. */
  nickname: z
    .string()
    .trim()
    .max(40)
    .regex(/^[^\p{Cc}]*$/u, 'No control characters')
    .nullable()
    .optional(),
})
export type UpdateMeInput = z.infer<typeof UpdateMeInput>

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8, 'At least 8 characters').max(128),
})
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>

/** Built-in admin sign-in with a username instead of an email. */
export const AdminLoginInput = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(128),
})
export type AdminLoginInput = z.infer<typeof AdminLoginInput>

export function isAdminRole(role: UserRole): boolean {
  return role === 'admin' || role === 'superadmin'
}
