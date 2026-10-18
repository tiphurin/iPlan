import type { InviteDto, InvitePreviewDto, TripRole } from '@iplan/contracts'
import type { InviteRow, InviteWithTrip } from './members.repository'

export function toInviteDto(row: InviteRow): InviteDto {
  return {
    id: row.id,
    token: row.token,
    role: row.role === 'editor' ? 'editor' : 'viewer',
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    useCount: row.useCount,
  }
}

export function toInvitePreviewDto(
  found: InviteWithTrip,
  currentRole: TripRole | null,
): InvitePreviewDto {
  return {
    tripId: found.invite.tripId,
    tripName: found.tripName,
    startDate: found.startDate,
    endDate: found.endDate,
    invitedBy: found.invitedBy,
    role: found.invite.role === 'editor' ? 'editor' : 'viewer',
    currentRole,
  }
}
