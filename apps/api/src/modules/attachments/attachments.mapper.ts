import type { AttachmentDto } from '@iplan/contracts'
import type { AttachmentRow } from './attachments.repository'

export function toAttachmentDto(row: AttachmentRow): AttachmentDto {
  return {
    id: row.id,
    kind: row.kind,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    url: `/api/attachments/${row.id}/file`,
    thumbUrl: row.thumbKey ? `/api/attachments/${row.id}/file?thumb=1` : null,
    createdAt: row.createdAt.toISOString(),
  }
}
