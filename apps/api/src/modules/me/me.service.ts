import type { FeatureKey, MeDto, UpdateMeInput } from '@iplan/contracts'
import type { SessionAccount } from '../../shared/context'
import { randomUUID } from 'node:crypto'
import type { StorageProvider } from '../../infra/storage'
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../../shared/avatar'
import { notFound, validationFailed } from '../../shared/errors'
import { toMeDto } from './me.mapper'
import type { MeRepository } from './me.repository'

export interface FeatureSource {
  featuresFor(account: SessionAccount): Promise<FeatureKey[]>
}

export class MeService {
  constructor(
    private readonly users: MeRepository,
    private readonly access: FeatureSource,
    private readonly storage?: StorageProvider,
  ) {}

  private requireStorage(): StorageProvider {
    if (!this.storage) throw new Error('Storage is not configured')
    return this.storage
  }

  /** Replaces the profile picture; the old file is deleted afterwards. */
  async setAvatar(
    actor: SessionAccount,
    file: { bytes: Uint8Array; contentType: string },
  ): Promise<MeDto> {
    const storage = this.requireStorage()
    if (!(AVATAR_TYPES as readonly string[]).includes(file.contentType)) {
      throw validationFailed({ file: 'Use a JPEG, PNG or WebP image' })
    }
    if (file.bytes.byteLength > AVATAR_MAX_BYTES) {
      throw validationFailed({ file: 'Image is too large' })
    }
    const before = await this.users.findById(actor.id)
    if (!before) throw notFound('User')
    const ext = file.contentType.split('/')[1] ?? 'webp'
    const key = `avatars/${actor.id}/${randomUUID()}.${ext}`
    await storage.put(key, file.bytes, file.contentType)
    const row = await this.users.update(actor.id, { avatarKey: key })
    if (!row) throw notFound('User')
    if (before.avatarKey) await storage.delete(before.avatarKey).catch(() => undefined)
    return toMeDto(row, actor, await this.access.featuresFor(actor))
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
    return toMeDto(row, actor, await this.access.featuresFor(actor))
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
    return toMeDto(row, actor, await this.access.featuresFor(actor))
  }

  async update(actor: SessionAccount, input: UpdateMeInput): Promise<MeDto> {
    const changes: { name?: string; locale?: string } = {}
    if (input.name !== undefined) changes.name = input.name
    if (input.locale !== undefined) changes.locale = input.locale
    const row =
      Object.keys(changes).length > 0
        ? await this.users.update(actor.id, changes)
        : await this.users.findById(actor.id)
    if (!row) throw notFound('User')
    return toMeDto(row, actor, await this.access.featuresFor(actor))
  }
}
