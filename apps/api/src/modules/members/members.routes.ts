import { createRoute, z } from '@hono/zod-openapi'
import {
  AcceptInviteDto,
  CreateInviteInput,
  InviteDto,
  InvitePreviewDto,
  UpdateMemberInput,
} from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { MembersService } from './members.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const tags = ['Members']
const MemberParams = z.object({ tripId: z.uuid(), userId: z.string().min(1) })
const TripParams = z.object({ tripId: z.uuid() })
const TokenParams = z.object({ token: z.string().min(10).max(64) })
const gone = { description: 'Invalid or expired invite', content: json(z.any()) }

const updateMember = createRoute({
  method: 'patch',
  path: '/trips/{tripId}/members/{userId}',
  tags,
  summary: "Change a member's role (owner only)",
  request: { params: MemberParams, body: { content: json(UpdateMemberInput), required: true } },
  responses: {
    204: { description: 'Updated' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
})

const removeMember = createRoute({
  method: 'delete',
  path: '/trips/{tripId}/members/{userId}',
  tags,
  summary: 'Remove a member (owner) or leave (yourself)',
  request: { params: MemberParams },
  responses: {
    204: { description: 'Removed' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
})

const createInvite = createRoute({
  method: 'post',
  path: '/trips/{tripId}/invites',
  tags,
  summary: 'Create a join link (editor or owner)',
  request: { params: TripParams, body: { content: json(CreateInviteInput), required: true } },
  responses: {
    201: { description: 'Invite', content: json(InviteDto) },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
})

const listInvites = createRoute({
  method: 'get',
  path: '/trips/{tripId}/invites',
  tags,
  summary: 'Active join links (editor or owner)',
  request: { params: TripParams },
  responses: {
    200: { description: 'Invites', content: json(z.array(InviteDto)) },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
})

const revokeInvite = createRoute({
  method: 'delete',
  path: '/invites/{inviteId}',
  tags,
  summary: 'Revoke a join link',
  request: { params: z.object({ inviteId: z.uuid() }) },
  responses: {
    204: { description: 'Revoked' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
})

const previewInvite = createRoute({
  method: 'get',
  path: '/join/{token}',
  tags,
  summary: 'What a join link leads to',
  request: { params: TokenParams },
  responses: {
    200: { description: 'Preview', content: json(InvitePreviewDto) },
    401: errorResponses[401],
    410: gone,
  },
})

const acceptInvite = createRoute({
  method: 'post',
  path: '/join/{token}',
  tags,
  summary: 'Join the trip through a link',
  request: { params: TokenParams },
  responses: {
    200: { description: 'Joined', content: json(AcceptInviteDto) },
    401: errorResponses[401],
    410: gone,
  },
})

export function memberRoutes(service: MembersService) {
  return createRouter()
    .openapi(updateMember, async (c) => {
      const { tripId, userId } = c.req.valid('param')
      await service.updateRole(requireUser(c), tripId, userId, c.req.valid('json').role)
      return c.body(null, 204)
    })
    .openapi(removeMember, async (c) => {
      const { tripId, userId } = c.req.valid('param')
      await service.remove(requireUser(c), tripId, userId)
      return c.body(null, 204)
    })
    .openapi(createInvite, async (c) =>
      c.json(
        await service.createInvite(
          requireUser(c),
          c.req.valid('param').tripId,
          c.req.valid('json'),
        ),
        201,
      ),
    )
    .openapi(listInvites, async (c) =>
      c.json(await service.listInvites(requireUser(c), c.req.valid('param').tripId), 200),
    )
    .openapi(revokeInvite, async (c) => {
      await service.revokeInvite(requireUser(c), c.req.valid('param').inviteId)
      return c.body(null, 204)
    })
    .openapi(previewInvite, async (c) =>
      c.json(await service.preview(requireUser(c), c.req.valid('param').token), 200),
    )
    .openapi(acceptInvite, async (c) =>
      c.json(await service.accept(requireUser(c), c.req.valid('param').token), 200),
    )
}
