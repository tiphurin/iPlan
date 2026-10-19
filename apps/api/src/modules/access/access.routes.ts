import { createRoute, z } from '@hono/zod-openapi'
import { CreateUserGroupInput, UpdateUserGroupInput, UserGroupDto } from '@iplan/contracts'
import { requireAdmin } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { AccessService } from './access.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const tags = ['Admin']
const denied = { 401: errorResponses[401], 403: errorResponses[403] }
const idParam = z.object({ id: z.uuid() })

const list = createRoute({
  method: 'get',
  path: '/admin/groups',
  tags,
  summary: 'User groups and the features they grant',
  responses: { 200: { description: 'Groups', content: json(z.array(UserGroupDto)) }, ...denied },
})
const create = createRoute({
  method: 'post',
  path: '/admin/groups',
  tags,
  summary: 'Create a group',
  request: { body: { content: json(CreateUserGroupInput), required: true } },
  responses: {
    201: { description: 'Group', content: json(UserGroupDto) },
    ...denied,
    409: errorResponses[409],
    422: errorResponses[422],
  },
})
const update = createRoute({
  method: 'patch',
  path: '/admin/groups/{id}',
  tags,
  summary: 'Rename a group or change its features',
  request: { params: idParam, body: { content: json(UpdateUserGroupInput), required: true } },
  responses: {
    200: { description: 'Group', content: json(UserGroupDto) },
    ...denied,
    404: errorResponses[404],
    409: errorResponses[409],
    422: errorResponses[422],
  },
})
const remove = createRoute({
  method: 'delete',
  path: '/admin/groups/{id}',
  tags,
  summary: 'Delete a group (members lose its features)',
  request: { params: idParam },
  responses: { 204: { description: 'Deleted' }, ...denied, 404: errorResponses[404] },
})

export function accessRoutes(service: AccessService) {
  return createRouter()
    .openapi(list, async (c) => c.json(await service.groups(requireAdmin(c)), 200))
    .openapi(create, async (c) =>
      c.json(await service.createGroup(requireAdmin(c), c.req.valid('json')), 201),
    )
    .openapi(update, async (c) =>
      c.json(
        await service.updateGroup(requireAdmin(c), c.req.valid('param').id, c.req.valid('json')),
        200,
      ),
    )
    .openapi(remove, async (c) => {
      await service.deleteGroup(requireAdmin(c), c.req.valid('param').id)
      return c.body(null, 204)
    })
}
