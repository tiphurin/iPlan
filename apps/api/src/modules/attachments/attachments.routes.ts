import { createRoute, z } from '@hono/zod-openapi'
import { AttachmentDto, AttachmentEntity, AttachmentKind, AttachmentQuery } from '@iplan/contracts'
import type { StorageProvider } from '../../infra/storage'
import { requireUser } from '../../shared/auth-guard'
import { validationFailed } from '../../shared/errors'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { AttachmentsService } from './attachments.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const tags = ['Attachments']
const IdParams = z.object({ id: z.uuid() })
const denied = { 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] }

const UploadForm = z.object({
  file: z.any().openapi({ type: 'string', format: 'binary' }),
  thumb: z.any().optional().openapi({ type: 'string', format: 'binary' }),
  entityType: AttachmentEntity,
  entityId: z.uuid(),
  kind: AttachmentKind,
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
})

const list = createRoute({
  method: 'get',
  path: '/attachments',
  tags,
  summary: 'Files attached to an expense or plan item',
  request: { query: AttachmentQuery },
  responses: { 200: { description: 'Files', content: json(z.array(AttachmentDto)) }, ...denied },
})
const upload = createRoute({
  method: 'post',
  path: '/attachments',
  tags,
  summary:
    'Upload a slip, photo or PDF (editor or owner). Images are resized in the browser first.',
  request: { body: { content: { 'multipart/form-data': { schema: UploadForm } }, required: true } },
  responses: {
    201: { description: 'Saved', content: json(AttachmentDto) },
    ...denied,
    422: errorResponses[422],
  },
})
const file = createRoute({
  method: 'get',
  path: '/attachments/{id}/file',
  tags,
  summary: 'Download (or redirect to a short-lived URL) after a permission check',
  request: { params: IdParams, query: z.object({ thumb: z.enum(['1']).optional() }) },
  responses: { 200: { description: 'File bytes' }, 302: { description: 'Signed URL' }, ...denied },
})
const remove = createRoute({
  method: 'delete',
  path: '/attachments/{id}',
  tags,
  summary: 'Delete a file (editor or owner)',
  request: { params: IdParams },
  responses: { 204: { description: 'Deleted' }, ...denied },
})

async function part(value: unknown, field: string) {
  if (!(value instanceof File)) throw validationFailed({ [field]: 'Attach a file' })
  return { bytes: new Uint8Array(await value.arrayBuffer()), contentType: value.type }
}

export function attachmentRoutes(service: AttachmentsService, storage: StorageProvider) {
  return createRouter()
    .openapi(list, async (c) => {
      const { entityType, entityId } = c.req.valid('query')
      return c.json(await service.list(requireUser(c), entityType, entityId), 200)
    })
    .openapi(upload, async (c) => {
      const actor = requireUser(c)
      const form = c.req.valid('form')
      const saved = await service.upload(actor, {
        entityType: form.entityType,
        entityId: form.entityId,
        kind: form.kind,
        file: await part(form.file, 'file'),
        thumb: form.thumb instanceof File ? await part(form.thumb, 'thumb') : undefined,
        width: form.width,
        height: form.height,
      })
      return c.json(saved, 201)
    })
    .openapi(file, async (c) => {
      const { key, contentType } = await service.file(
        requireUser(c),
        c.req.valid('param').id,
        c.req.valid('query').thumb === '1',
      )
      if (storage.signedUrl) return c.redirect(await storage.signedUrl(key, 300), 302)
      const bytes = await storage.get(key)
      if (!bytes) return c.json({ error: { code: 'NOT_FOUND', message: 'File missing' } }, 404)
      return c.body(bytes, 200, {
        'content-type': contentType,
        // Private: only this signed-in browser may cache it.
        'cache-control': 'private, max-age=86400, immutable',
        'x-content-type-options': 'nosniff',
      })
    })
    .openapi(remove, async (c) => {
      await service.remove(requireUser(c), c.req.valid('param').id)
      return c.body(null, 204)
    })
}
