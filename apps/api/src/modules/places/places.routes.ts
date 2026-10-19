import { createRoute, z } from '@hono/zod-openapi'
import { PlaceDto, PlaceQuery } from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { PlacesService } from './places.service'

const search = createRoute({
  method: 'get',
  path: '/places',
  tags: ['Places'],
  summary: 'Place suggestions (OpenStreetMap via Photon)',
  request: { query: PlaceQuery },
  responses: {
    200: {
      description: 'Up to 6 places',
      content: { 'application/json': { schema: z.array(PlaceDto) } },
    },
    401: errorResponses[401],
    422: errorResponses[422],
  },
})

export function placesRoutes(service: PlacesService) {
  return createRouter().openapi(search, async (c) => {
    requireUser(c)
    const { q, lat, lng, kind } = c.req.valid('query')
    const near = lat !== undefined && lng !== undefined ? { lat, lng } : undefined
    return c.json(await service.search(q, near, kind), 200)
  })
}
