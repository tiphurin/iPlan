import { z } from 'zod'

export const InvitationKind = z.enum(['trip', 'ledger'])
export type InvitationKind = z.infer<typeof InvitationKind>

/** An invitation waiting for the invited person to accept or decline. */
export const InvitationDto = z.object({
  id: z.uuid(),
  kind: InvitationKind,
  targetId: z.uuid(),
  targetName: z.string(),
  role: z.string(),
  invitedByName: z.string().nullable(),
  createdAt: z.iso.datetime(),
})
export type InvitationDto = z.infer<typeof InvitationDto>

/** Pending invitation as the inviter sees it (who hasn't answered yet). */
export const PendingInviteDto = z.object({
  id: z.uuid(),
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  role: z.string(),
})
export type PendingInviteDto = z.infer<typeof PendingInviteDto>

export const InviteUserInput = z.object({
  userId: z.string().min(1),
  /** Trips only; shared wallets always invite as a member. */
  role: z.enum(['editor', 'viewer']).default('editor'),
})
export type InviteUserInput = z.infer<typeof InviteUserInput>

export const AcceptInvitationDto = z.object({ kind: InvitationKind, targetId: z.uuid() })
export type AcceptInvitationDto = z.infer<typeof AcceptInvitationDto>
