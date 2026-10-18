import { z } from 'zod'
import { TripRole } from './trips'

/** Roles that can be handed out; ownership never moves through an invite. */
export const InviteRole = z.enum(['editor', 'viewer'])
export type InviteRole = z.infer<typeof InviteRole>

export const UpdateMemberInput = z.object({ role: InviteRole })
export type UpdateMemberInput = z.infer<typeof UpdateMemberInput>

export const CreateInviteInput = z.object({
  role: InviteRole.default('editor'),
  /** Link lifetime in days. */
  expiresInDays: z.number().int().min(1).max(30).default(7),
})
export type CreateInviteInput = z.infer<typeof CreateInviteInput>

export const InviteDto = z.object({
  id: z.uuid(),
  token: z.string(),
  role: InviteRole,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  useCount: z.number().int(),
})
export type InviteDto = z.infer<typeof InviteDto>

/** What someone holding a link sees before joining. */
export const InvitePreviewDto = z.object({
  tripId: z.uuid(),
  tripName: z.string(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  invitedBy: z.string().nullable(),
  role: InviteRole,
  /** The caller's current role, when already a member. */
  currentRole: TripRole.nullable(),
})
export type InvitePreviewDto = z.infer<typeof InvitePreviewDto>

export const AcceptInviteDto = z.object({ tripId: z.uuid(), role: TripRole })
export type AcceptInviteDto = z.infer<typeof AcceptInviteDto>
