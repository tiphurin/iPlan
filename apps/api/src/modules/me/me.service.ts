import type { FeatureKey, MeDto, UpdateMeInput } from '@iplan/contracts'
import type { SessionAccount } from '../../shared/context'
import { randomUUID } from 'node:crypto'
import type { StorageProvider } from '../../infra/storage'
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../../shared/avatar'
import { forbidden, notFound, validationFailed } from '../../shared/errors'
import { sniffType } from '../../shared/file-type'
import { toMeDto } from './me.mapper'
import type { MeRepository, UserChanges, UserRow } from './me.repository'

export interface FeatureSource {
  featuresFor(account: SessionAccount): Promise<FeatureKey[]>
}

export class MeService {
  constructor(
    private readonly users: MeRepository,
    private readonly access: FeatureSource,
    private readonly storage?: StorageProvider,
  ) {}

  private async dto(row: UserRow, actor: SessionAccount): Promise<MeDto> {
    const [features, hasPassword] = await Promise.all([
      this.access.featuresFor(actor),
      this.users.hasPassword(row.id),
    ])
    return toMeDto(row, actor, features, hasPassword)
  }

  /** After the password changed: the bootstrap password no longer has to be replaced. */
  async passwordChanged(actor: SessionAccount): Promise<MeDto> {
    const row = await this.users.update(actor.id, { mustChangePassword: false })
    if (!row) throw notFound('User')
    return this.dto(row, { ...actor, mustChangePassword: false })
  }

  private requireStorage(): StorageProvider {
    if (!this.storage) throw new Error('Storage is not configured')
    return this.storage
  }

  /**
   * Replaces the profile picture; the old file is deleted afterwards. The type comes
   * from the bytes themselves, never from what the browser declared.
   */
  async setAvatar(actor: SessionAccount, bytes: Uint8Array): Promise<MeDto> {
    const storage = this.requireStorage()
    if (actor.status !== 'active') throw forbidden('Waiting for approval')
    if (bytes.byteLength > AVATAR_MAX_BYTES) {
      throw validationFailed({ file: 'Image is too large' })
    }
    const contentType = sniffType(bytes)
    if (!contentType || !(AVATAR_TYPES as readonly string[]).includes(contentType)) {
      throw validationFailed({ file: 'Use a JPEG, PNG or WebP image' })
    }
    const before = await this.users.findById(actor.id)
    if (!before) throw notFound('User')
    const ext = contentType.split('/')[1] ?? 'webp'
    const key = `avatars/${actor.id}/${randomUUID()}.${ext}`
    await storage.put(key, bytes, contentType)
    const row = await this.users.update(actor.id, { avatarKey: key })
    if (!row) throw notFound('User')
    if (before.avatarKey) await storage.delete(before.avatarKey).catch(() => undefined)
    return this.dto(row, actor)
  }

  /** Back to the Google photo (or initials). */
  async removeAvatar(actor: SessionAccount): Promise<MeDto> {
    const before = await this.users.findById(actor.id)
    if (!before) throw notFound('User')
    const row = await this.users.update(actor.id, { avatarKey: null })
    if (!row) throw notFound('User')
    if (before.avatarKey) {
      await this.requireStorage()
        .delete(before.avatarKey)
        .catch(() => undefined)
    }
    return this.dto(row, actor)
  }

  /** Storage key and type of someone's uploaded picture, or null. */
  async avatarFile(userId: string): Promise<{ key: string; contentType: string } | null> {
    const row = await this.users.findById(userId)
    if (!row?.avatarKey) return null
    const ext = row.avatarKey.split('.').pop() ?? 'webp'
    return { key: row.avatarKey, contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` }
  }

  async get(actor: SessionAccount): Promise<MeDto> {
    const row = await this.users.findById(actor.id)
    if (!row) throw notFound('User')
    return this.dto(row, actor)
  }

  async update(actor: SessionAccount, input: UpdateMeInput): Promise<MeDto> {
    const changes: UserChanges = {}
    if (input.name !== undefined) changes.name = input.name
    if (input.locale !== undefined) changes.locale = input.locale
    if (input.nickname !== undefined) changes.nickname = input.nickname || null
    const row =
      Object.keys(changes).length > 0
        ? await this.users.update(actor.id, changes)
        : await this.users.findById(actor.id)
    if (!row) throw notFound('User')
    return this.dto(row, actor)
  }
}
