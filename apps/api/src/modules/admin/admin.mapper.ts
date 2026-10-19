import type { AdminUserDto, AuditEntryDto } from '@iplan/contracts'
import type { AuditRow, UserRow } from './admin.repository'

export const toAdminUserDto = (row: UserRow): AdminUserDto => ({
  id: row.id,
  name: row.name,
  email: row.email,
  image: row.image,
  role: row.role === 'admin' ? 'admin' : 'user',
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
