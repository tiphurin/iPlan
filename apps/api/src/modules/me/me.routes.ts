import { createRoute, z } from '@hono/zod-openapi'
import type { StorageProvider } from '../../infra/storage'
import { MeDto, UpdateMeInput } from '@iplan/contracts'
import { requireAccount, requireUser } from '../../shared/auth-guard'
import { validationFailed } from '../../shared/errors'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { MeService } from './me.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })

const getMe = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Me'],
  summary: 'Current user, approval status and enabled features',
  responses: {
    200: { description: 'The signed-in user', content: json(MeDto) },
    401: errorResponses[401],
  },
})

const updateMe = createRoute({
  method: 'patch',
  path: '/me',
  tags: ['Me'],
  summary: 'Update name or language',
  request: { body: { content: json(UpdateMeInput), required: true } },
  responses: {
    200: { description: 'Updated user', content: json(MeDto) },
    401: errorResponses[401],
    422: errorResponses[422],
  },
})

const uploadAvatar = createRoute({
  method: 'post',
  path: '/me/avatar',
  tags: ['Me'],
  summary: 'Upload a profile picture (the browser shrinks it to 400 px first)',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.any().openapi({ type: 'string', format: 'binary' }) }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: { description: 'Updated user', content: json(MeDto) },
    401: errorResponses[401],
    422: errorResponses[422],
  },
})

const removeAvatar = createRoute({
  method: 'delete',
  path: '/me/avatar',
  tags: ['Me'],
  summary: 'Remove the uploaded picture',
  responses: {
    200: { description: 'Updated user', content: json(MeDto) },
    401: errorResponses[401],
  },
})

const getAvatar = createRoute({
  method: 'get',
  path: '/users/{id}/avatar',
  tags: ['Me'],
  summary: "Someone's uploaded picture (signed-in, approved users only)",
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: {
    200: { description: 'Image' },
    302: { description: 'Redirect to a short-lived URL' },
    401: errorResponses[401],
    404: errorResponses[404],
  },
})

export function meRoutes(service: MeService, storage?: StorageProvider) {
  return createRouter()
    .openapi(uploadAvatar, async (c) => {
      const actor = requireAccount(c)
      const { file } = c.req.valid('form')
      if (!(file instanceof File)) throw validationFailed({ file: 'Attach a file' })
      const bytes = new Uint8Array(await file.arrayBuffer())
      return c.json(await service.setAvatar(actor, { bytes, contentType: file.type }), 200)
    })
    .openapi(removeAvatar, async (c) => c.json(await service.removeAvatar(requireAccount(c)), 200))
    .openapi(getAvatar, async (c) => {
      requireUser(c)
      const found = await service.avatarFile(c.req.valid('param').id)
      if (!found || !storage) {
        return c.json({ error: { code: 'NOT_FOUND' as const, message: 'No picture' } }, 404)
      }
      if (storage.signedUrl) return c.redirect(await storage.signedUrl(found.key, 3600), 302)
      const bytes = await storage.get(found.key)
      if (!bytes)
        return c.json({ error: { code: 'NOT_FOUND' as const, message: 'No picture' } }, 404)
      return c.body(bytes, 200, {
        'content-type': found.contentType,
        // The URL changes with every upload (?v=), so it can be cached for long.
        'cache-control': 'private, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      })
    })
    .openapi(getMe, async (c) => c.json(await service.get(requireAccount(c)), 200))
    .openapi(updateMe, async (c) =>
      c.json(await service.update(requireAccount(c), c.req.valid('json')), 200),
    )
}
