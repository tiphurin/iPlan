import { createRoute, z } from '@hono/zod-openapi'
import {
  CheckInInput,
  CreateTripItemInput,
  TripItemDto,
  UpdateTripItemInput,
} from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { ItemsService } from './items.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const TripParams = z.object({ tripId: z.uuid() })
const ItemParams = z.object({ itemId: z.uuid() })
const item = { description: 'Item', content: json(TripItemDto) }
const tags = ['Itinerary']

const listItems = createRoute({
  method: 'get',
  path: '/trips/{tripId}/items',
  tags,
  summary: 'All itinerary items of a trip, in time order',
  request: { params: TripParams },
  responses: {
    200: { description: 'Items', content: json(z.array(TripItemDto)) },
    401: errorResponses[401],
    404: errorResponses[404],
  },
})

const createItem = createRoute({
  method: 'post',
  path: '/trips/{tripId}/items',
  tags,
  summary: 'Add an item (editor or owner)',
  request: { params: TripParams, body: { content: json(CreateTripItemInput), required: true } },
  responses: {
    201: item,
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
  },
})

const updateItem = createRoute({
  method: 'patch',
  path: '/items/{itemId}',
  tags,
  summary: 'Edit an item (editor or owner)',
  request: { params: ItemParams, body: { content: json(UpdateTripItemInput), required: true } },
  responses: {
    200: item,
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
  },
})

const deleteItem = createRoute({
  method: 'delete',
  path: '/items/{itemId}',
  tags,
  summary: 'Delete an item (editor or owner)',
  request: { params: ItemParams },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
})

const duplicateItem = createRoute({
  method: 'post',
  path: '/items/{itemId}/duplicate',
  tags,
  summary: 'Copy an item on the same day (editor or owner)',
  request: { params: ItemParams },
  responses: {
    201: item,
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
})

const checkIn = createRoute({
  method: 'post',
  path: '/items/{itemId}/check-in',
  tags,
  summary: 'Check yourself in (any member)',
  request: { params: ItemParams, body: { content: json(CheckInInput), required: false } },
  responses: {
    200: item,
    401: errorResponses[401],
    404: errorResponses[404],
    422: errorResponses[422],
  },
})

const undoCheckIn = createRoute({
  method: 'delete',
  path: '/items/{itemId}/check-in',
  tags,
  summary: 'Undo your check-in',
  request: { params: ItemParams },
  responses: { 200: item, 401: errorResponses[401], 404: errorResponses[404] },
})

export function itemRoutes(service: ItemsService) {
  return createRouter()
    .openapi(listItems, async (c) =>
      c.json(await service.list(requireUser(c), c.req.valid('param').tripId), 200),
    )
    .openapi(createItem, async (c) =>
      c.json(
        await service.create(requireUser(c), c.req.valid('param').tripId, c.req.valid('json')),
        201,
      ),
    )
    .openapi(updateItem, async (c) =>
      c.json(
        await service.update(requireUser(c), c.req.valid('param').itemId, c.req.valid('json')),
        200,
      ),
    )
    .openapi(deleteItem, async (c) => {
      await service.remove(requireUser(c), c.req.valid('param').itemId)
      return c.body(null, 204)
    })
    .openapi(duplicateItem, async (c) =>
      c.json(await service.duplicate(requireUser(c), c.req.valid('param').itemId), 201),
    )
    .openapi(checkIn, async (c) => {
      const body = c.req.header('content-type')?.includes('json') ? c.req.valid('json') : {}
      return c.json(await service.checkIn(requireUser(c), c.req.valid('param').itemId, body), 200)
    })
    .openapi(undoCheckIn, async (c) =>
      c.json(await service.undoCheckIn(requireUser(c), c.req.valid('param').itemId), 200),
    )
}
