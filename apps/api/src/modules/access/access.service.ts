import {
  type CircleDto,
  type CircleInput,
  type CreateUserGroupInput,
  FEATURE_KEYS,
  type FeatureKey,
  type UpdateUserGroupInput,
  type UserGroupDto,
} from '@iplan/contracts'
import type { AuditLog } from '../../shared/audit'
import { type SessionAccount, type SessionUser, isAdmin } from '../../shared/context'
import { AppError, conflict, forbidden, notFound } from '../../shared/errors'
import { knownFeatures, toCircleDto, toUserGroupDto } from './access.mapper'
import type { AccessRepository } from './access.repository'

/** Who may use which feature, and the admin screens that manage groups. */
export class AccessService {
  constructor(
    private readonly access: AccessRepository,
    private readonly audit: AuditLog,
  ) {}

  /** Admins see everything; pending accounts see nothing. */
  async featuresFor(account: SessionAccount): Promise<FeatureKey[]> {
    if (isAdmin(account)) return [...FEATURE_KEYS]
    if (account.status !== 'active') return []
    const granted = new Set(knownFeatures(await this.access.featuresFor(account.id)))
    return FEATURE_KEYS.filter((key) => granted.has(key))
  }

  async requireFeature(user: SessionUser, feature: FeatureKey): Promise<void> {
    const features = await this.featuresFor({ ...user, status: 'active' })
    if (!features.includes(feature)) {
      throw new AppError('FEATURE_DISABLED', 403, `Feature "${feature}" is not enabled for you`)
    }
  }

  /** True when both people are in at least one common circle (who may invite whom). */
  async shareCircle(a: string, b: string): Promise<boolean> {
    const circles = await this.access.circleIdsFor([a, b])
    const mine = new Set(circles.get(a) ?? [])
    return (circles.get(b) ?? []).some((id) => mine.has(id))
  }

  /** Inviting someone needs a shared circle, unless the inviter is an admin. */
  async requireSharedCircle(actor: SessionUser, userId: string): Promise<void> {
    if (isAdmin(actor)) return
    if (!(await this.shareCircle(actor.id, userId))) {
      throw new AppError('NOT_IN_CIRCLE', 403, 'You can only invite people in your circles')
    }
  }

  private check(actor: SessionUser) {
    if (!isAdmin(actor)) throw forbidden('Admin only')
  }

  async groups(actor: SessionUser): Promise<UserGroupDto[]> {
    this.check(actor)
    return (await this.access.groups()).map(toUserGroupDto)
  }

  async createGroup(actor: SessionUser, input: CreateUserGroupInput): Promise<UserGroupDto> {
    this.check(actor)
    await this.ensureUniqueName(input.name)
    const id = await this.access.createGroup(
      { name: input.name, description: input.description ?? null },
      [...new Set(input.features)],
    )
    await this.audit.record({
      actorId: actor.id,
      action: 'group.create',
      entityType: 'user_group',
      entityId: id,
      data: { name: input.name, features: input.features },
    })
    return this.found(id)
  }

  async updateGroup(
    actor: SessionUser,
    id: string,
    input: UpdateUserGroupInput,
  ): Promise<UserGroupDto> {
    this.check(actor)
    await this.found(id)
    if (input.name !== undefined) await this.ensureUniqueName(input.name, id)
    const fields: { name?: string; description?: string | null } = {}
    if (input.name !== undefined) fields.name = input.name
    if (input.description !== undefined) fields.description = input.description
    await this.access.updateGroup(
      id,
      fields,
      input.features ? [...new Set(input.features)] : undefined,
    )
    await this.audit.record({
      actorId: actor.id,
      action: 'group.update',
      entityType: 'user_group',
      entityId: id,
      data: { ...input },
    })
    return this.found(id)
  }

  async deleteGroup(actor: SessionUser, id: string): Promise<void> {
    this.check(actor)
    const group = await this.found(id)
    await this.access.deleteGroup(id)
    await this.audit.record({
      actorId: actor.id,
      action: 'group.delete',
      entityType: 'user_group',
      entityId: id,
      data: { name: group.name },
    })
  }

  async circles(actor: SessionUser): Promise<CircleDto[]> {
    this.check(actor)
    return (await this.access.circles()).map(toCircleDto)
  }

  async createCircle(actor: SessionUser, input: CircleInput): Promise<CircleDto> {
    this.check(actor)
    await this.ensureUniqueCircle(input.name)
    const id = await this.access.createCircle(input.name)
    await this.audit.record({
      actorId: actor.id,
      action: 'circle.create',
      entityType: 'circle',
      entityId: id,
      data: { name: input.name },
    })
    return this.foundCircle(id)
  }

  async renameCircle(actor: SessionUser, id: string, input: CircleInput): Promise<CircleDto> {
    this.check(actor)
    await this.foundCircle(id)
    await this.ensureUniqueCircle(input.name, id)
    await this.access.renameCircle(id, input.name)
    await this.audit.record({
      actorId: actor.id,
      action: 'circle.update',
      entityType: 'circle',
      entityId: id,
      data: { name: input.name },
    })
    return this.foundCircle(id)
  }

  async deleteCircle(actor: SessionUser, id: string): Promise<void> {
    this.check(actor)
    const circle = await this.foundCircle(id)
    await this.access.deleteCircle(id)
    await this.audit.record({
      actorId: actor.id,
      action: 'circle.delete',
      entityType: 'circle',
      entityId: id,
      data: { name: circle.name },
    })
  }

  private async foundCircle(id: string): Promise<CircleDto> {
    const row = (await this.access.circles()).find((c) => c.id === id)
    if (!row) throw notFound('Circle')
    return toCircleDto(row)
  }

  private async ensureUniqueCircle(name: string, exceptId?: string) {
    const clash = (await this.access.circles()).find(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== exceptId,
    )
    if (clash) throw conflict('A circle with this name already exists')
  }

  private async found(id: string): Promise<UserGroupDto> {
    const row = await this.access.group(id)
    if (!row) throw notFound('Group')
    return toUserGroupDto(row)
  }

  private async ensureUniqueName(name: string, exceptId?: string) {
    const clash = (await this.access.groups()).find(
      (g) => g.name.toLowerCase() === name.toLowerCase() && g.id !== exceptId,
    )
    if (clash) throw conflict('A group with this name already exists')
  }
}
