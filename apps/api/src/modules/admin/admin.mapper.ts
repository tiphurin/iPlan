import { knownFeatures } from '../access/access.mapper'
import { avatarUrl } from '../../shared/avatar'
import { type AdminUserDto, type AuditEntryDto, UserRole } from '@iplan/contracts'
import type { AuditRow, UserRow } from './admin.repository'

export const toAdminUserDto = (
  row: UserRow,
  groupIds: string[],
  circleIds: string[],
  features: string[] = [],
): AdminUserDto => ({
  id: row.id,
  name: row.name,
  nickname: row.nickname,
  email: row.email,
  image: avatarUrl(row),
  role: UserRole.catch('user').parse(row.role),
  status: row.status === 'active' ? 'active' : 'pending',
  groupIds,
  circleIds,
  features: knownFeatures(features),
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
