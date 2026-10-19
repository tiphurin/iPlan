import { z } from 'zod'
import { FeatureKey, UserStatus } from './features'

export const Locale = z.enum(['th', 'en'])
export type Locale = z.infer<typeof Locale>

export const UserRole = z.enum(['user', 'admin'])
export type UserRole = z.infer<typeof UserRole>

export const MeDto = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
  role: UserRole,
  status: UserStatus,
  /** Features this user may open; drives the tab bar and dashboard. */
  features: z.array(FeatureKey),
  locale: Locale,
  createdAt: z.iso.datetime(),
})
export type MeDto = z.infer<typeof MeDto>

export const UpdateMeInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  locale: Locale.optional(),
})
export type UpdateMeInput = z.infer<typeof UpdateMeInput>
