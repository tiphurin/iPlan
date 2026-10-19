import { randomUUID } from 'node:crypto'
import {
  ATTACHMENT_TYPES,
  type AttachmentDto,
  type AttachmentEntity,
  type AttachmentKind,
  MAX_ATTACHMENT_BYTES,
} from '@iplan/contracts'
import type { StorageProvider } from '../../infra/storage'
import type { AuditLog } from '../../shared/audit'
import type { SessionUser } from '../../shared/context'
import { notFound, validationFailed } from '../../shared/errors'
import type { TripAccess } from '../trips/trips.service'
import { toAttachmentDto } from './attachments.mapper'
import type { AttachmentsRepository } from './attachments.repository'

export interface UploadInput {
  entityType: AttachmentEntity
  entityId: string
  kind: AttachmentKind
  file: { bytes: Uint8Array; contentType: string }
  thumb?: { bytes: Uint8Array; contentType: string } | undefined
  width?: number | undefined
  height?: number | undefined
}

const EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
}

/** Real file signature, so a renamed file can't pretend to be an image. */
export function sniffType(bytes: Uint8Array): string | null {
  const b = (i: number) => bytes[i] ?? -1
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg'
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return 'image/png'
  if (
    b(0) === 0x52 &&
    b(1) === 0x49 &&
    b(2) === 0x46 &&
    b(3) === 0x46 &&
    b(8) === 0x57 &&
    b(9) === 0x45 &&
    b(10) === 0x42 &&
    b(11) === 0x50
  ) {
    return 'image/webp'
  }
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return 'application/pdf'
  return null
}

export class AttachmentsService {
  constructor(
    private readonly attachments: AttachmentsRepository,
    private readonly storage: StorageProvider,
    private readonly trips: TripAccess,
    private readonly audit: AuditLog,
  ) {}

  /** Checks access and returns where the files go: `trips/<id>` or `users/<id>`. */
  private async scopeFor(
    actor: SessionUser,
    entityType: AttachmentEntity,
    entityId: string,
    minimum: 'viewer' | 'editor',
  ): Promise<{ tripId: string | null; prefix: string }> {
    const scope = await this.attachments.scopeOf(entityType, entityId)
    if (!scope) throw notFound('Item')
    if ('ownerId' in scope) {
      // Personal finance files are visible to their owner only.
      if (scope.ownerId !== actor.id) throw notFound('Item')
      return { tripId: null, prefix: `users/${actor.id}` }
    }
    await this.trips.requireAccess(actor, scope.tripId, minimum)
    return { tripId: scope.tripId, prefix: `trips/${scope.tripId}` }
  }

  private async checkRow(
    actor: SessionUser,
    row: { tripId: string | null; ownerId: string | null },
    minimum: 'viewer' | 'editor',
  ) {
    if (row.tripId) await this.trips.requireAccess(actor, row.tripId, minimum)
    else if (row.ownerId !== actor.id) throw notFound('Attachment')
  }

  private checkFile(part: { bytes: Uint8Array; contentType: string }, field: string): string {
    if (part.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
      throw validationFailed({ [field]: 'File is larger than 5 MB' })
    }
    const sniffed = sniffType(part.bytes)
    if (!sniffed || !(ATTACHMENT_TYPES as readonly string[]).includes(sniffed)) {
      throw validationFailed({ [field]: 'Only JPEG, PNG, WebP or PDF files are allowed' })
    }
    return sniffed
  }

  async list(
    actor: SessionUser,
    entityType: AttachmentEntity,
    entityId: string,
  ): Promise<AttachmentDto[]> {
    await this.scopeFor(actor, entityType, entityId, 'viewer')
    return (await this.attachments.list(entityType, entityId)).map(toAttachmentDto)
  }

  async upload(actor: SessionUser, input: UploadInput): Promise<AttachmentDto> {
    const { tripId, prefix } = await this.scopeFor(
      actor,
      input.entityType,
      input.entityId,
      'editor',
    )
    const contentType = this.checkFile(input.file, 'file')
    const thumbType = input.thumb ? this.checkFile(input.thumb, 'thumb') : null
    const id = randomUUID()
    const storageKey = `${prefix}/${id}.${EXT[contentType]}`
    const thumbKey = thumbType ? `${prefix}/${id}.thumb.${EXT[thumbType]}` : null
    await this.storage.put(storageKey, input.file.bytes, contentType)
    if (thumbKey && input.thumb && thumbType)
      await this.storage.put(thumbKey, input.thumb.bytes, thumbType)
    const row = await this.attachments.create({
      ownerId: actor.id,
      tripId,
      entityType: input.entityType,
      entityId: input.entityId,
      kind: input.kind,
      storageKey,
      thumbKey,
      contentType,
      sizeBytes: input.file.bytes.byteLength + (input.thumb?.bytes.byteLength ?? 0),
      width: input.width ?? null,
      height: input.height ?? null,
    })
    await this.audit.record({
      actorId: actor.id,
      action: 'attachment.upload',
      entityType: input.entityType,
      entityId: input.entityId,
      data: { attachmentId: row.id, kind: input.kind, bytes: row.sizeBytes },
    })
    return toAttachmentDto(row)
  }

  /** Where to read the bytes from, after checking the viewer can see the trip. */
  async file(actor: SessionUser, id: string, thumb: boolean) {
    const row = await this.attachments.find(id)
    if (!row) throw notFound('Attachment')
    await this.checkRow(actor, row, 'viewer')
    if (thumb && row.thumbKey) {
      const ext = row.thumbKey.split('.').at(-1) ?? ''
      const type = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? 'image/jpeg'
      return { key: row.thumbKey, contentType: type }
    }
    return { key: row.storageKey, contentType: row.contentType }
  }

  async remove(actor: SessionUser, id: string): Promise<void> {
    const row = await this.attachments.find(id)
    if (!row) throw notFound('Attachment')
    await this.checkRow(actor, row, 'editor')
    await this.attachments.delete(id)
    await this.storage.delete(row.storageKey)
    if (row.thumbKey) await this.storage.delete(row.thumbKey)
    await this.audit.record({
      actorId: actor.id,
      action: 'attachment.delete',
      entityType: row.entityType,
      entityId: row.entityId,
      data: { attachmentId: id },
    })
  }
}
