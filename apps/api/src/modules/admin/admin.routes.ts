import { createRoute, z } from '@hono/zod-openapi'
import {
  AdminLedgerDto,
  AdminStatsDto,
  AdminTripDto,
  AdminUpdateUserInput,
  AdminUserDataDto,
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
  summary: 'Approve, change role or groups, suspend / unsuspend',
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: { content: json(AdminUpdateUserInput), required: true },
  },
  responses: {
    200: { description: 'User', content: json(AdminUserDto) },
    ...denied,
    404: errorResponses[404],
    409: errorResponses[409],
  },
})
const userData = createRoute({
  method: 'get',
  path: '/admin/users/{id}/data',
  tags,
  summary: "A user's trips and shared wallets (read-only, logged)",
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: {
    200: { description: 'Overview', content: json(AdminUserDataDto) },
    ...denied,
    404: errorResponses[404],
  },
})
const allTrips = createRoute({
  method: 'get',
  path: '/admin/trips',
  tags,
  summary: 'Every trip in the system',
  responses: { 200: { description: 'Trips', content: json(z.array(AdminTripDto)) }, ...denied },
})
const allLedgers = createRoute({
  method: 'get',
  path: '/admin/ledgers',
  tags,
  summary: 'Every shared wallet in the system',
  responses: { 200: { description: 'Wallets', content: json(z.array(AdminLedgerDto)) }, ...denied },
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
      const { q, page, status } = c.req.valid('query')
      return c.json(await service.users(requireAdmin(c), q, page, status), 200)
    })
    .openapi(updateUser, async (c) =>
      c.json(
        await service.updateUser(requireAdmin(c), c.req.valid('param').id, c.req.valid('json')),
        200,
      ),
    )
    .openapi(userData, async (c) =>
      c.json(await service.userData(requireAdmin(c), c.req.valid('param').id), 200),
    )
    .openapi(allTrips, async (c) => c.json(await service.allTrips(requireAdmin(c)), 200))
    .openapi(allLedgers, async (c) => c.json(await service.allLedgers(requireAdmin(c)), 200))
    .openapi(audit, async (c) => {
      const { page, action } = c.req.valid('query')
      return c.json(await service.auditLog(requireAdmin(c), page, action), 200)
    })
}
