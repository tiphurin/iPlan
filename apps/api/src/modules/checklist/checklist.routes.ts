import { createRoute, z } from '@hono/zod-openapi'
import {
  ChecklistItemDto,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
} from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { ChecklistService } from './checklist.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const tags = ['Checklist']
const TripParams = z.object({ tripId: z.uuid() })
const ItemParams = z.object({ itemId: z.uuid() })
const item = { description: 'Checklist item', content: json(ChecklistItemDto) }
const denied = { 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] }

const list = createRoute({
  method: 'get',
  path: '/trips/{tripId}/checklist',
  tags,
  summary: 'Checklist with who ticked each item',
  request: { params: TripParams },
  responses: { 200: { description: 'Items', content: json(z.array(ChecklistItemDto)) }, ...denied },
})
const create = createRoute({
  method: 'post',
  path: '/trips/{tripId}/checklist',
  tags,
  summary: 'Add an item (editor or owner)',
  request: {
    params: TripParams,
    body: { content: json(CreateChecklistItemInput), required: true },
  },
  responses: { 201: item, ...denied, 422: errorResponses[422] },
})
const update = createRoute({
  method: 'patch',
  path: '/checklist/{itemId}',
  tags,
  summary: 'Rename or move an item (editor or owner)',
  request: {
    params: ItemParams,
    body: { content: json(UpdateChecklistItemInput), required: true },
  },
  responses: { 200: item, ...denied, 422: errorResponses[422] },
})
const remove = createRoute({
  method: 'delete',
  path: '/checklist/{itemId}',
  tags,
  summary: 'Delete an item (editor or owner)',
  request: { params: ItemParams },
  responses: { 204: { description: 'Deleted' }, ...denied },
})
const tick = createRoute({
  method: 'post',
  path: '/checklist/{itemId}/tick',
  tags,
  summary: 'Tick an item (any member)',
  request: { params: ItemParams },
  responses: { 200: item, ...denied },
})
const untick = createRoute({
  method: 'delete',
  path: '/checklist/{itemId}/tick',
  tags,
  summary: 'Untick an item',
  request: { params: ItemParams },
  responses: { 200: item, ...denied },
})

export function checklistRoutes(service: ChecklistService) {
  return createRouter()
    .openapi(list, async (c) =>
      c.json(await service.list(requireUser(c), c.req.valid('param').tripId), 200),
    )
    .openapi(create, async (c) =>
      c.json(
        await service.create(requireUser(c), c.req.valid('param').tripId, c.req.valid('json')),
        201,
      ),
    )
    .openapi(update, async (c) =>
      c.json(
        await service.update(requireUser(c), c.req.valid('param').itemId, c.req.valid('json')),
        200,
      ),
    )
    .openapi(remove, async (c) => {
      await service.remove(requireUser(c), c.req.valid('param').itemId)
      return c.body(null, 204)
    })
    .openapi(tick, async (c) =>
      c.json(await service.setTicked(requireUser(c), c.req.valid('param').itemId, true), 200),
    )
    .openapi(untick, async (c) =>
      c.json(await service.setTicked(requireUser(c), c.req.valid('param').itemId, false), 200),
    )
}
