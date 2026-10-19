import { createRoute, z } from '@hono/zod-openapi'
import { PeopleQuery, PersonDto } from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { PeopleService } from './people.service'

const search = createRoute({
  method: 'get',
  path: '/people',
  tags: ['People'],
  summary: 'People in your circles; filter by name, nickname or email',
  request: { query: PeopleQuery },
  responses: {
    200: {
      description: 'Up to 20 people',
      content: { 'application/json': { schema: z.array(PersonDto) } },
    },
    401: errorResponses[401],
    422: errorResponses[422],
  },
})

export function peopleRoutes(service: PeopleService) {
  return createRouter().openapi(search, async (c) =>
    c.json(await service.search(requireUser(c), c.req.valid('query').q), 200),
  )
}
