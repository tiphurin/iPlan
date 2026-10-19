import type {
  AdminLedgerDto,
  AdminTripDto,
  AdminUserDataDto,
  UserStatus,
  AdminStatsDto,
  AdminUpdateUserInput,
  AdminUserDto,
  AdminUserListDto,
  AuditListDto,
} from '@iplan/contracts'
import type { AuditLog } from '../../shared/audit'
import { isAdmin, isSuperAdmin } from '../../shared/context'
import type { Notifier } from '../../shared/notifier'
import type { AccessRepository } from '../access/access.repository'
import type { SessionUser } from '../../shared/context'
import { AppError, forbidden, notFound } from '../../shared/errors'
import { toAdminUserDto, toAuditEntryDto } from './admin.mapper'
import type { AdminRepository, UserRow } from './admin.repository'

/** Lists what a user is part of, for the admin's read-only view. */
export interface UserDataSource {
  trips(userId: string): Promise<AdminUserDataDto['trips']>
  ledgers(userId: string): Promise<AdminUserDataDto['ledgers']>
}

/** The repositories a user update writes to, bound to one transaction. */
export interface AdminWrites {
  admin: AdminRepository
  access: AccessRepository
}
export type UnitOfWork = <T>(work: (repos: AdminWrites) => Promise<T>) => Promise<T>

export interface AdminOptions {
  /** ADMIN_EMAILS (lower-cased): admins even if their stored role says otherwise. */
  adminEmails?: readonly string[]
  /** Runs the writes of one update atomically; defaults to no transaction (tests). */
  transaction?: UnitOfWork
}

/** Admin-only operations. Every method re-checks the caller's role. */
export class AdminService {
  private readonly adminEmails: Set<string>
  private readonly transaction: UnitOfWork

  constructor(
    private readonly admin: AdminRepository,
    private readonly access: AccessRepository,
    private readonly audit: AuditLog,
    private readonly people?: UserDataSource,
    private readonly notifier?: Notifier,
    options: AdminOptions = {},
  ) {
    this.adminEmails = new Set((options.adminEmails ?? []).map((e) => e.toLowerCase()))
    this.transaction = options.transaction ?? ((work) => work({ admin, access }))
  }

  private check(actor: SessionUser) {
    if (!isAdmin(actor)) throw forbidden('Admin only')
  }

  private async dto(row: UserRow): Promise<AdminUserDto> {
    const [groups, circles, features] = await Promise.all([
      this.access.groupIdsFor([row.id]),
      this.access.circleIdsFor([row.id]),
      this.access.directFeaturesFor([row.id]),
    ])
    return toAdminUserDto(
      row,
      groups.get(row.id) ?? [],
      circles.get(row.id) ?? [],
      features.get(row.id) ?? [],
    )
  }

  async allTrips(actor: SessionUser): Promise<AdminTripDto[]> {
    this.check(actor)
    return this.admin.allTrips()
  }

  async allLedgers(actor: SessionUser): Promise<AdminLedgerDto[]> {
    this.check(actor)
    return this.admin.allLedgers()
  }

  /** Read-only view of what one user has: trips and shared wallets (logged). */
  async userData(actor: SessionUser, userId: string): Promise<AdminUserDataDto> {
    this.check(actor)
    const row = await this.admin.user(userId)
    if (!row || !this.people) throw notFound('User')
    const [trips, ledgers] = await Promise.all([
      this.people.trips(userId),
      this.people.ledgers(userId),
    ])
    await this.audit.record({
      actorId: actor.id,
      action: 'admin.view',
      entityType: 'user',
      entityId: userId,
    })
    return { user: await this.dto(row), trips, ledgers }
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
    const ids = rows.map((r) => r.id)
    const [groups, circles, features] = await Promise.all([
      this.access.groupIdsFor(ids),
      this.access.circleIdsFor(ids),
      this.access.directFeaturesFor(ids),
    ])
    return {
      users: rows.map((r) =>
        toAdminUserDto(
          r,
          groups.get(r.id) ?? [],
          circles.get(r.id) ?? [],
          features.get(r.id) ?? [],
        ),
      ),
      total,
    }
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
    const touchesAccount =
      input.role !== undefined || input.banned !== undefined || input.status !== undefined
    // The built-in admin can't be demoted, suspended or sent back to the waiting list,
    // and only it may change its own groups, circles or features.
    if (existing.role === 'superadmin' && (touchesAccount || !isSuperAdmin(actor))) {
      throw new AppError('SUPERADMIN_PROTECTED', 409, 'The built-in admin cannot be changed')
    }
    // Only the superadmin appoints or removes admins.
    if (input.role !== undefined && !isSuperAdmin(actor)) {
      throw forbidden('Only the super admin can change roles')
    }
    // Only the superadmin changes another admin, including owners listed in ADMIN_EMAILS.
    const targetIsAdmin =
      existing.role === 'admin' || this.adminEmails.has(existing.email.toLowerCase())
    if (targetIsAdmin && userId !== actor.id && !isSuperAdmin(actor)) {
      throw forbidden('Only the super admin can change another admin')
    }
    // Validate everything before writing anything.
    if (input.groupIds) {
      const known = new Set((await this.access.groups()).map((g) => g.id))
      if (input.groupIds.some((id) => !known.has(id))) throw notFound('Group')
    }
    if (input.circleIds) {
      const known = new Set((await this.access.circles()).map((c) => c.id))
      if (input.circleIds.some((id) => !known.has(id))) throw notFound('Circle')
    }
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
    await this.transaction(async ({ admin, access }) => {
      if (Object.keys(changes).length > 0) await admin.updateUser(userId, changes)
      if (input.groupIds) await access.setUserGroups(userId, [...new Set(input.groupIds)])
      if (input.circleIds) await access.setUserCircles(userId, [...new Set(input.circleIds)])
      if (input.features) await access.setUserFeatures(userId, [...new Set(input.features)])
      if (input.banned) await admin.revokeSessions(userId)
    })
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
                : input.role !== undefined
                  ? 'admin.role'
                  : 'admin.groups',
      entityType: 'user',
      entityId: userId,
      data: {
        ...changes,
        ...(input.groupIds && { groupIds: input.groupIds }),
        ...(input.circleIds && { circleIds: input.circleIds }),
        ...(input.features && { features: input.features }),
      },
    })
    const updated = await this.admin.user(userId)
    if (!updated) throw notFound('User')
    if (input.status === 'active' && existing.status !== 'active' && this.notifier) {
      const features = await this.access.featuresFor(userId)
      this.notifier.approved(
        { email: updated.email, name: updated.name, locale: updated.locale },
        features,
      )
    }
    return this.dto(updated)
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
