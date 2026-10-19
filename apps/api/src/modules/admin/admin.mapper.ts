import { avatarUrl } from '../../shared/avatar'
import type { AdminUserDto, AuditEntryDto } from '@iplan/contracts'
import type { AuditRow, UserRow } from './admin.repository'

export const toAdminUserDto = (row: UserRow, groupIds: string[]): AdminUserDto => ({
  id: row.id,
  name: row.name,
  email: row.email,
  image: avatarUrl(row),
  role: row.role === 'admin' ? 'admin' : 'user',
  status: row.status === 'active' ? 'active' : 'pending',
  groupIds,
  banned: row.banned === true,
  banReason: row.banReason,
  createdAt: row.createdAt.toISOString(),
  trips: row.trips,
})

export const toAuditEntryDto = (row: AuditRow): AuditEntryDto => ({
  id: row.id,
  actorId: row.actorId,
  actorName: row.actorName,
  action: row.action,
  entityType: row.entityType,
  entityId: row.entityId,
  data: row.data,
  createdAt: row.createdAt.toISOString(),
})
