import { createRoute, z } from '@hono/zod-openapi'
import { CreateInfoCardInput, InfoCardDto, UpdateInfoCardInput } from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { InfoCardsService } from './info-cards.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const tags = ['Info cards']
const TripParams = z.object({ tripId: z.uuid() })
const CardParams = z.object({ cardId: z.uuid() })
const card = { description: 'Info card', content: json(InfoCardDto) }
const denied = { 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] }

const list = createRoute({
  method: 'get',
  path: '/trips/{tripId}/info',
  tags,
  summary: 'Info cards of a trip',
  request: { params: TripParams },
  responses: { 200: { description: 'Cards', content: json(z.array(InfoCardDto)) }, ...denied },
})
const create = createRoute({
  method: 'post',
  path: '/trips/{tripId}/info',
  tags,
  summary: 'Add a card (editor or owner)',
  request: { params: TripParams, body: { content: json(CreateInfoCardInput), required: true } },
  responses: { 201: card, ...denied, 422: errorResponses[422] },
})
const update = createRoute({
  method: 'patch',
  path: '/info/{cardId}',
  tags,
  summary: 'Edit a card (editor or owner)',
  request: { params: CardParams, body: { content: json(UpdateInfoCardInput), required: true } },
  responses: { 200: card, ...denied, 422: errorResponses[422] },
})
const remove = createRoute({
  method: 'delete',
  path: '/info/{cardId}',
  tags,
  summary: 'Delete a card (editor or owner)',
  request: { params: CardParams },
  responses: { 204: { description: 'Deleted' }, ...denied },
})

export function infoCardRoutes(service: InfoCardsService) {
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
        await service.update(requireUser(c), c.req.valid('param').cardId, c.req.valid('json')),
        200,
      ),
    )
    .openapi(remove, async (c) => {
      await service.remove(requireUser(c), c.req.valid('param').cardId)
      return c.body(null, 204)
    })
}
