import { createRoute, z } from '@hono/zod-openapi'
import { CreateTripInput, TripDetailDto, TripDto, UpdateTripInput } from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { TripsService } from './trips.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const TripParams = z.object({ tripId: z.uuid() })

const listTrips = createRoute({
  method: 'get',
  path: '/trips',
  tags: ['Trips'],
  summary: 'Trips I belong to',
  responses: {
    200: { description: 'Trips', content: json(z.array(TripDto)) },
    401: errorResponses[401],
  },
})

const createTrip = createRoute({
  method: 'post',
  path: '/trips',
  tags: ['Trips'],
  summary: 'Create a trip (you become its owner)',
  request: { body: { content: json(CreateTripInput), required: true } },
  responses: {
    201: { description: 'Created', content: json(TripDetailDto) },
    401: errorResponses[401],
    422: errorResponses[422],
  },
})

const getTrip = createRoute({
  method: 'get',
  path: '/trips/{tripId}',
  tags: ['Trips'],
  summary: 'Trip with members',
  request: { params: TripParams },
  responses: {
    200: { description: 'Trip', content: json(TripDetailDto) },
    401: errorResponses[401],
    404: errorResponses[404],
  },
})

const updateTrip = createRoute({
  method: 'patch',
  path: '/trips/{tripId}',
  tags: ['Trips'],
  summary: 'Edit trip details (editor or owner)',
  request: { params: TripParams, body: { content: json(UpdateTripInput), required: true } },
  responses: {
    200: { description: 'Updated', content: json(TripDetailDto) },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
  },
})

const deleteTrip = createRoute({
  method: 'delete',
  path: '/trips/{tripId}',
  tags: ['Trips'],
  summary: 'Delete a trip (owner only)',
  request: { params: TripParams },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
})

export function tripRoutes(service: TripsService) {
  return createRouter()
    .openapi(listTrips, async (c) => c.json(await service.list(requireUser(c)), 200))
    .openapi(createTrip, async (c) =>
      c.json(await service.create(requireUser(c), c.req.valid('json')), 201),
    )
    .openapi(getTrip, async (c) =>
      c.json(await service.get(requireUser(c), c.req.valid('param').tripId), 200),
    )
    .openapi(updateTrip, async (c) =>
      c.json(
        await service.update(requireUser(c), c.req.valid('param').tripId, c.req.valid('json')),
        200,
      ),
    )
    .openapi(deleteTrip, async (c) => {
      await service.remove(requireUser(c), c.req.valid('param').tripId)
      return c.body(null, 204)
    })
}
