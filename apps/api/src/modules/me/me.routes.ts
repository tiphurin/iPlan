import { createRoute } from '@hono/zod-openapi'
import { MeDto, UpdateMeInput } from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { MeService } from './me.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })

const getMe = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Me'],
  summary: 'Current user',
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

export function meRoutes(service: MeService) {
  return createRouter()
    .openapi(getMe, async (c) => c.json(await service.get(requireUser(c)), 200))
    .openapi(updateMe, async (c) =>
      c.json(await service.update(requireUser(c), c.req.valid('json')), 200),
    )
}
