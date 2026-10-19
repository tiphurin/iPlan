import { createRoute, z } from '@hono/zod-openapi'
import { AcceptInvitationDto, InvitationDto } from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { InvitationsService } from './invitations.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const tags = ['Invitations']
const idParam = z.object({ id: z.uuid() })
const common = { 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] }

const mine = createRoute({
  method: 'get',
  path: '/invitations',
  tags,
  summary: 'Invitations waiting for me',
  responses: {
    200: { description: 'Invitations', content: json(z.array(InvitationDto)) },
    ...common,
  },
})
const accept = createRoute({
  method: 'post',
  path: '/invitations/{id}/accept',
  tags,
  summary: 'Join the trip or shared wallet',
  request: { params: idParam },
  responses: { 200: { description: 'Joined', content: json(AcceptInvitationDto) }, ...common },
})
const remove = createRoute({
  method: 'delete',
  path: '/invitations/{id}',
  tags,
  summary: 'Decline (invited person) or cancel (inviter)',
  request: { params: idParam },
  responses: { 204: { description: 'Removed' }, ...common },
})

export function invitationRoutes(service: InvitationsService) {
  return createRouter()
    .openapi(mine, async (c) => c.json(await service.mine(requireUser(c)), 200))
    .openapi(accept, async (c) =>
      c.json(await service.accept(requireUser(c), c.req.valid('param').id), 200),
    )
    .openapi(remove, async (c) => {
      await service.remove(requireUser(c), c.req.valid('param').id)
      return c.body(null, 204)
    })
}
