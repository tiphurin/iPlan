import { createRoute, z } from '@hono/zod-openapi'
import {
  AdminStatsDto,
  AdminUpdateUserInput,
  AdminUserDto,
  AdminUserListDto,
  AdminUserQuery,
  AuditListDto,
  AuditQuery,
} from '@iplan/contracts'
import { requireAdmin } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { AdminService } from './admin.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const tags = ['Admin']
const denied = { 401: errorResponses[401], 403: errorResponses[403] }

const stats = createRoute({
  method: 'get',
  path: '/admin/stats',
  tags,
  summary: 'Counts and storage use',
  responses: { 200: { description: 'Stats', content: json(AdminStatsDto) }, ...denied },
})
const users = createRoute({
  method: 'get',
  path: '/admin/users',
  tags,
  summary: 'Search users by name or email',
  request: { query: AdminUserQuery },
  responses: { 200: { description: 'Users', content: json(AdminUserListDto) }, ...denied },
})
const updateUser = createRoute({
  method: 'patch',
  path: '/admin/users/{id}',
  tags,
  summary: 'Change role or suspend / unsuspend',
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: { content: json(AdminUpdateUserInput), required: true },
  },
  responses: {
    200: { description: 'User', content: json(AdminUserDto) },
    ...denied,
    404: errorResponses[404],
  },
})
const audit = createRoute({
  method: 'get',
  path: '/admin/audit',
  tags,
  summary: 'Audit log, newest first',
  request: { query: AuditQuery },
  responses: { 200: { description: 'Entries', content: json(AuditListDto) }, ...denied },
})

export function adminRoutes(service: AdminService) {
  return createRouter()
    .openapi(stats, async (c) => c.json(await service.stats(requireAdmin(c)), 200))
    .openapi(users, async (c) => {
      const { q, page } = c.req.valid('query')
      return c.json(await service.users(requireAdmin(c), q, page), 200)
    })
    .openapi(updateUser, async (c) =>
      c.json(
        await service.updateUser(requireAdmin(c), c.req.valid('param').id, c.req.valid('json')),
        200,
      ),
    )
    .openapi(audit, async (c) => {
      const { page, action } = c.req.valid('query')
      return c.json(await service.auditLog(requireAdmin(c), page, action), 200)
    })
}
