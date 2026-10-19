import { createRoute, z } from '@hono/zod-openapi'
import type { StorageProvider } from '../../infra/storage'
import { AdminLoginInput, ChangePasswordInput, MeDto, UpdateMeInput } from '@iplan/contracts'
import type { AuthGateway } from '../../infra/auth'
import { FailureLimiter, clientIp } from '../../infra/rate-limit'
import { SUPERADMIN } from '../../infra/superadmin'
import { AVATAR_MAX_BYTES } from '../../shared/avatar'
import { requireAccount, requireUser } from '../../shared/auth-guard'
import { AppError, forbidden, validationFailed } from '../../shared/errors'
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
    403: errorResponses[403],
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

const changePassword = createRoute({
  method: 'post',
  path: '/me/password',
  tags: ['Me'],
  summary: 'Change the password (built-in admin account)',
  request: { body: { content: json(ChangePasswordInput), required: true } },
  responses: {
    200: { description: 'Updated user', content: json(MeDto) },
    401: errorResponses[401],
    403: errorResponses[403],
    422: errorResponses[422],
  },
})

const adminLogin = createRoute({
  method: 'post',
  path: '/admin-login',
  tags: ['Me'],
  summary: 'Sign in to the built-in admin account with username and password',
  request: { body: { content: json(AdminLoginInput), required: true } },
  responses: {
    200: { description: 'Signed in; session cookie set' },
    401: errorResponses[401],
    422: errorResponses[422],
    429: { description: 'Too many failed attempts', content: errorResponses[401].content },
  },
})

const wrongPassword = () => new AppError('PASSWORD_INVALID', 401, 'Wrong username or password')

export function meRoutes(
  service: MeService,
  storage?: StorageProvider,
  auth?: AuthGateway,
  // 5 wrong passwords per 15 minutes per address and username.
  loginFailures = new FailureLimiter(),
) {
  return createRouter()
    .openapi(adminLogin, async (c) => {
      const { username, password } = c.req.valid('json')
      const key = `${clientIp(c.req.raw.headers)}|${username.toLowerCase()}`
      const wait = loginFailures.retryAfter(key)
      if (wait > 0) {
        c.header('retry-after', String(wait))
        throw new AppError('TOO_MANY_ATTEMPTS', 429, 'Too many failed sign-in attempts')
      }
      if (!auth || username.toLowerCase() !== SUPERADMIN.username) {
        loginFailures.fail(key)
        throw wrongPassword()
      }
      const response = await auth.signInWithPassword(SUPERADMIN.email, password)
      if (!response.ok) {
        loginFailures.fail(key)
        throw wrongPassword()
      }
      loginFailures.reset(key)
      return response
    })
    .openapi(changePassword, async (c) => {
      const actor = requireAccount(c)
      // Only the built-in admin has a password (dev-login accounts don't count).
      if (actor.role !== 'superadmin') throw forbidden('Only the super admin has a password')
      const { currentPassword, newPassword } = c.req.valid('json')
      if (currentPassword === newPassword) {
        throw validationFailed({ newPassword: 'Choose a different password' })
      }
      if (!auth || !(await auth.changePassword(c.req.raw.headers, currentPassword, newPassword))) {
        throw new AppError('PASSWORD_INVALID', 422, 'Current password is wrong', {
          currentPassword: 'Wrong password',
        })
      }
      return c.json(await service.passwordChanged(actor), 200)
    })
    .openapi(uploadAvatar, async (c) => {
      // Approved accounts only; pending people can't fill storage.
      requireUser(c)
      const actor = requireAccount(c)
      const { file } = c.req.valid('form')
      if (!(file instanceof File)) throw validationFailed({ file: 'Attach a file' })
      // Checked before reading, so a huge upload isn't buffered for nothing.
      if (file.size > AVATAR_MAX_BYTES) throw validationFailed({ file: 'Image is too large' })
      const bytes = new Uint8Array(await file.arrayBuffer())
      return c.json(await service.setAvatar(actor, bytes), 200)
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
