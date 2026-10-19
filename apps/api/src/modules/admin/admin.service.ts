import type {
  AdminStatsDto,
  AdminUpdateUserInput,
  AdminUserDto,
  AdminUserListDto,
  AuditListDto,
} from '@iplan/contracts'
import type { AuditLog } from '../../shared/audit'
import type { SessionUser } from '../../shared/context'
import { AppError, forbidden, notFound } from '../../shared/errors'
import { toAdminUserDto, toAuditEntryDto } from './admin.mapper'
import type { AdminRepository } from './admin.repository'

/** Admin-only operations. Every method re-checks the caller's role. */
export class AdminService {
  constructor(
    private readonly admin: AdminRepository,
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
  ): Promise<AdminUserListDto> {
    this.check(actor)
    const { rows, total } = await this.admin.users(query, page)
    return { users: rows.map(toAdminUserDto), total }
  }

  async updateUser(
    actor: SessionUser,
    userId: string,
    input: AdminUpdateUserInput,
  ): Promise<AdminUserDto> {
    this.check(actor)
    if (userId === actor.id && (input.role === 'user' || input.banned === true)) {
      // Prevents locking the last admin out by accident.
      throw new AppError('CANNOT_CHANGE_SELF', 409, "You can't demote or suspend yourself")
    }
    const existing = await this.admin.user(userId)
    if (!existing) throw notFound('User')
    const changes: { role?: string; banned?: boolean; banReason?: string | null } = {}
    if (input.role !== undefined) changes.role = input.role
    if (input.banned !== undefined) {
      changes.banned = input.banned
      changes.banReason = input.banned ? (input.banReason ?? null) : null
    }
    await this.admin.updateUser(userId, changes)
    if (input.banned) await this.admin.revokeSessions(userId)
    await this.audit.record({
      actorId: actor.id,
      action:
        input.banned === true
          ? 'admin.suspend'
          : input.banned === false
            ? 'admin.unsuspend'
            : 'admin.role',
      entityType: 'user',
      entityId: userId,
      data: { ...changes },
    })
    const updated = await this.admin.user(userId)
    if (!updated) throw notFound('User')
    return toAdminUserDto(updated)
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
