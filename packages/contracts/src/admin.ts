import { z } from 'zod'
import { FeatureKey, UserStatus } from './features'
import { UserRole } from './me'

export const AdminStatsDto = z.object({
  users: z.number().int(),
  newUsers30d: z.number().int(),
  suspendedUsers: z.number().int(),
  pendingUsers: z.number().int(),
  activeSessions: z.number().int(),
  trips: z.number().int(),
  tripItems: z.number().int(),
  expenses: z.number().int(),
  transactions: z.number().int(),
  attachments: z.number().int(),
  storageBytes: z.number().int(),
  databaseBytes: z.number().int(),
})
export type AdminStatsDto = z.infer<typeof AdminStatsDto>

export const AdminUserDto = z.object({
  id: z.string(),
  name: z.string(),
  nickname: z.string().nullable(),
  email: z.string(),
  image: z.string().nullable(),
  role: UserRole,
  status: UserStatus,
  groupIds: z.array(z.uuid()),
  circleIds: z.array(z.uuid()),
  /** Features given to this person directly. */
  features: z.array(FeatureKey),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  trips: z.number().int(),
})
export type AdminUserDto = z.infer<typeof AdminUserDto>

export const AdminUserListDto = z.object({
  users: z.array(AdminUserDto),
  total: z.number().int(),
})
export type AdminUserListDto = z.infer<typeof AdminUserListDto>

export const AdminUserQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: UserStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
})

export const AdminUpdateUserInput = z.object({
  /** Only the superadmin may change roles, and nobody can grant superadmin. */
  role: z.enum(['user', 'admin']).optional(),
  /** Approve (active) or send back to the waiting list (pending). */
  status: UserStatus.optional(),
  /** Replaces the user's groups. */
  groupIds: z.array(z.uuid()).max(50).optional(),
  /** Replaces the features given to this person directly. */
  features: z.array(FeatureKey).max(20).optional(),
  /** Replaces the user's circles (people who can find each other). */
  circleIds: z.array(z.uuid()).max(50).optional(),
  /** true suspends (signs out everywhere, blocks sign-in); false lifts it. */
  banned: z.boolean().optional(),
  banReason: z.string().trim().max(200).nullable().optional(),
})
export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserInput>

export const AuditEntryDto = z.object({
  id: z.uuid(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
})
export type AuditEntryDto = z.infer<typeof AuditEntryDto>

export const AuditListDto = z.object({ entries: z.array(AuditEntryDto), total: z.number().int() })
export type AuditListDto = z.infer<typeof AuditListDto>

export const AuditQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  action: z.string().trim().max(60).optional(),
})

export const UserGroupDto = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  features: z.array(FeatureKey),
  memberCount: z.number().int(),
  createdAt: z.iso.datetime(),
})
export type UserGroupDto = z.infer<typeof UserGroupDto>

const groupFields = {
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).nullable().optional(),
  features: z.array(FeatureKey).max(20),
}
export const CreateUserGroupInput = z.object(groupFields)
export type CreateUserGroupInput = z.infer<typeof CreateUserGroupInput>
export const UpdateUserGroupInput = z.object(groupFields).partial()
export type UpdateUserGroupInput = z.infer<typeof UpdateUserGroupInput>

/** A circle: people in it can find each other to invite into trips and shared wallets. */
export const CircleDto = z.object({
  id: z.uuid(),
  name: z.string(),
  memberCount: z.number().int(),
  createdAt: z.iso.datetime(),
})
export type CircleDto = z.infer<typeof CircleDto>

export const CircleInput = z.object({ name: z.string().trim().min(1).max(60) })
export type CircleInput = z.infer<typeof CircleInput>

/** What an admin sees about one user's data (read-only overview). */
export const AdminUserDataDto = z.object({
  user: AdminUserDto,
  trips: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      startDate: z.iso.date(),
      endDate: z.iso.date(),
      role: z.string(),
    }),
  ),
  ledgers: z.array(z.object({ id: z.uuid(), name: z.string(), role: z.string() })),
})
export type AdminUserDataDto = z.infer<typeof AdminUserDataDto>

/** Every trip in the system, for admins. */
export const AdminTripDto = z.object({
  id: z.uuid(),
  name: z.string(),
  destination: z.string().nullable(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  ownerName: z.string().nullable(),
  memberCount: z.number().int(),
})
export type AdminTripDto = z.infer<typeof AdminTripDto>

/** Every shared wallet in the system, for admins. */
export const AdminLedgerDto = z.object({
  id: z.uuid(),
  name: z.string(),
  ownerName: z.string().nullable(),
  memberCount: z.number().int(),
  entryCount: z.number().int(),
})
export type AdminLedgerDto = z.infer<typeof AdminLedgerDto>
