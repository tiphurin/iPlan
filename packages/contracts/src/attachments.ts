import { z } from 'zod'

export const AttachmentKind = z.enum(['slip', 'photo', 'file'])
export type AttachmentKind = z.infer<typeof AttachmentKind>

/** What a file can be attached to. */
export const AttachmentEntity = z.enum(['expense', 'trip_item', 'transaction'])
export type AttachmentEntity = z.infer<typeof AttachmentEntity>

export const ATTACHMENT_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

export const AttachmentDto = z.object({
  id: z.uuid(),
  kind: AttachmentKind,
  contentType: z.string(),
  sizeBytes: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  /** Always served through the API, which checks permissions. */
  url: z.string(),
  thumbUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
})
export type AttachmentDto = z.infer<typeof AttachmentDto>

export const AttachmentQuery = z.object({
  entityType: AttachmentEntity,
  entityId: z.uuid(),
})
