import { createRoute, z } from '@hono/zod-openapi'
import { CreateTripInput, TripDetailDto, TripDto, UpdateTripInput } from '@iplan/contracts'
import type { StorageProvider } from '../../infra/storage'
import { requireUser } from '../../shared/auth-guard'
import { validationFailed } from '../../shared/errors'
import { createRouter, errorResponses } from '../../shared/openapi'
import { MAX_COVER_BYTES, type TripsService } from './trips.service'

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

const uploadCover = createRoute({
  method: 'put',
  path: '/trips/{tripId}/cover',
  tags: ['Trips'],
  summary: 'Set the cover photo (editor or owner; the browser shrinks it to 1600 px WebP first)',
  request: {
    params: TripParams,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.any().openapi({ type: 'string', format: 'binary' }) }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: { description: 'Updated trip', content: json(TripDetailDto) },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
  },
})

const removeCover = createRoute({
  method: 'delete',
  path: '/trips/{tripId}/cover',
  tags: ['Trips'],
  summary: 'Remove the cover photo and go back to the colour (editor or owner)',
  request: { params: TripParams },
  responses: {
    200: { description: 'Updated trip', content: json(TripDetailDto) },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
})

const getCover = createRoute({
  method: 'get',
  path: '/trips/{tripId}/cover',
  tags: ['Trips'],
  summary: 'Cover photo (members only; redirects to a short-lived URL in production)',
  request: { params: TripParams },
  responses: {
    200: { description: 'Image' },
    302: { description: 'Redirect to a short-lived URL' },
    401: errorResponses[401],
    404: errorResponses[404],
  },
})

export function tripRoutes(service: TripsService, storage?: StorageProvider) {
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
    .openapi(uploadCover, async (c) => {
      const actor = requireUser(c)
      const { file } = c.req.valid('form')
      if (!(file instanceof File)) throw validationFailed({ file: 'Attach a file' })
      // Checked before reading, so a huge upload isn't buffered for nothing.
      if (file.size > MAX_COVER_BYTES) throw validationFailed({ file: 'File is larger than 5 MB' })
      const bytes = new Uint8Array(await file.arrayBuffer())
      return c.json(await service.setCover(actor, c.req.valid('param').tripId, bytes), 200)
    })
    .openapi(removeCover, async (c) =>
      c.json(await service.removeCover(requireUser(c), c.req.valid('param').tripId), 200),
    )
    .openapi(getCover, async (c) => {
      const found = await service.coverFile(requireUser(c), c.req.valid('param').tripId)
      if (!found || !storage) {
        return c.json({ error: { code: 'NOT_FOUND' as const, message: 'No cover' } }, 404)
      }
      if (storage.signedUrl) return c.redirect(await storage.signedUrl(found.key, 300), 302)
      const bytes = await storage.get(found.key)
      if (!bytes) return c.json({ error: { code: 'NOT_FOUND' as const, message: 'No cover' } }, 404)
      return c.body(bytes, 200, {
        'content-type': found.contentType,
        // The URL changes with every upload (?v=); private so only this signed-in browser keeps it.
        'cache-control': 'private, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      })
    })
}
