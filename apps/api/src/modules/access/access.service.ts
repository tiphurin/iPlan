import {
  type CreateUserGroupInput,
  FEATURE_KEYS,
  type FeatureKey,
  type UpdateUserGroupInput,
  type UserGroupDto,
} from '@iplan/contracts'
import type { AuditLog } from '../../shared/audit'
import type { SessionAccount, SessionUser } from '../../shared/context'
import { AppError, conflict, forbidden, notFound } from '../../shared/errors'
import { knownFeatures, toUserGroupDto } from './access.mapper'
import type { AccessRepository } from './access.repository'

/** Who may use which feature, and the admin screens that manage groups. */
export class AccessService {
  constructor(
    private readonly access: AccessRepository,
    private readonly audit: AuditLog,
  ) {}

  /** Admins see everything; pending accounts see nothing. */
  async featuresFor(account: SessionAccount): Promise<FeatureKey[]> {
    if (account.role === 'admin') return [...FEATURE_KEYS]
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

  private check(actor: SessionUser) {
    if (actor.role !== 'admin') throw forbidden('Admin only')
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
