import type {
  UserStatus,
  AdminStatsDto,
  AdminUpdateUserInput,
  AdminUserDto,
  AdminUserListDto,
  AuditListDto,
} from '@iplan/contracts'
import type { AuditLog } from '../../shared/audit'
import type { AccessRepository } from '../access/access.repository'
import type { SessionUser } from '../../shared/context'
import { AppError, forbidden, notFound } from '../../shared/errors'
import { toAdminUserDto, toAuditEntryDto } from './admin.mapper'
import type { AdminRepository } from './admin.repository'

/** Admin-only operations. Every method re-checks the caller's role. */
export class AdminService {
  constructor(
    private readonly admin: AdminRepository,
    private readonly access: AccessRepository,
    private readonly audit: AuditLog,
  ) {}

  private check(actor: SessionUser) {
    if (actor.role !== 'admin') throw forbidden('Admin only')
  }

  async stats(actor: SessionUser, now = new Date()): Promise<AdminStatsDto> {
    this.check(actor)
    return this.admin.stats(now)
  }

  async users(
    actor: SessionUser,
    query: string | undefined,
    page: number,
    status?: UserStatus,
  ): Promise<AdminUserListDto> {
    this.check(actor)
    const { rows, total } = await this.admin.users(query, page, status)
    const groups = await this.access.groupIdsFor(rows.map((r) => r.id))
    return { users: rows.map((r) => toAdminUserDto(r, groups.get(r.id) ?? [])), total }
  }

  async updateUser(
    actor: SessionUser,
    userId: string,
    input: AdminUpdateUserInput,
  ): Promise<AdminUserDto> {
    this.check(actor)
    if (
      userId === actor.id &&
      (input.role === 'user' || input.banned === true || input.status === 'pending')
    ) {
      // Prevents locking the last admin out by accident.
      throw new AppError('CANNOT_CHANGE_SELF', 409, "You can't demote or suspend yourself")
    }
    const existing = await this.admin.user(userId)
    if (!existing) throw notFound('User')
    const changes: {
      role?: string
      status?: string
      banned?: boolean
      banReason?: string | null
    } = {}
    if (input.role !== undefined) changes.role = input.role
    if (input.status !== undefined) changes.status = input.status
    if (input.banned !== undefined) {
      changes.banned = input.banned
      changes.banReason = input.banned ? (input.banReason ?? null) : null
    }
    if (input.groupIds) {
      const known = new Set((await this.access.groups()).map((g) => g.id))
      const unknown = input.groupIds.find((id) => !known.has(id))
      if (unknown) throw notFound('Group')
    }
    if (Object.keys(changes).length > 0) await this.admin.updateUser(userId, changes)
    if (input.groupIds) await this.access.setUserGroups(userId, [...new Set(input.groupIds)])
    if (input.banned) await this.admin.revokeSessions(userId)
    await this.audit.record({
      actorId: actor.id,
      action:
        input.banned === true
          ? 'admin.suspend'
          : input.banned === false
            ? 'admin.unsuspend'
            : input.status === 'active'
              ? 'admin.approve'
              : input.status === 'pending'
                ? 'admin.unapprove'
                : input.groupIds && input.role === undefined
                  ? 'admin.groups'
                  : 'admin.role',
      entityType: 'user',
      entityId: userId,
      data: { ...changes, ...(input.groupIds && { groupIds: input.groupIds }) },
    })
    const updated = await this.admin.user(userId)
    if (!updated) throw notFound('User')
    const groups = await this.access.groupIdsFor([userId])
    return toAdminUserDto(updated, groups.get(userId) ?? [])
  }

  async auditLog(
    actor: SessionUser,
    page: number,
    action: string | undefined,
  ): Promise<AuditListDto> {
    this.check(actor)
    const { rows, total } = await this.admin.audit(page, action)
    return { entries: rows.map(toAuditEntryDto), total }
  }
}
