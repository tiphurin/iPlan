import { createRoute, z } from '@hono/zod-openapi'
import { TripBackup } from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { BackupService } from './backup.service'

const tags = ['Backup']
const TripParams = z.object({ tripId: z.uuid() })
const denied = { 401: errorResponses[401], 404: errorResponses[404] }
const fileName = (name: string, ext: string) =>
  `${
    name
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'trip'
  }.${ext}`

const itemCalendar = createRoute({
  method: 'get',
  path: '/trips/{tripId}/items/{itemId}/event.ics',
  tags: ['Backup'],
  summary: 'One plan item as an .ics (Apple Calendar); re-open to update it',
  request: { params: z.object({ tripId: z.uuid(), itemId: z.uuid() }) },
  responses: {
    200: { description: 'ICS', content: { 'text/calendar': { schema: z.string() } } },
    401: errorResponses[401],
    404: errorResponses[404],
  },
})
const calendar = createRoute({
  method: 'get',
  path: '/trips/{tripId}/calendar.ics',
  tags,
  summary: 'The whole plan as an iCalendar file (opens in iPhone Calendar)',
  request: { params: TripParams },
  responses: {
    200: { description: 'ICS', content: { 'text/calendar': { schema: z.string() } } },
    ...denied,
  },
})
const exportTrip = createRoute({
  method: 'get',
  path: '/trips/{tripId}/backup.json',
  tags,
  summary: 'Download the trip as an iplan.trip v1 file',
  request: { params: TripParams },
  responses: {
    200: { description: 'Backup', content: { 'application/json': { schema: TripBackup } } },
    ...denied,
  },
})
const importTrip = createRoute({
  method: 'post',
  path: '/trips/import',
  tags,
  summary: 'Create a new trip from an iplan.trip file (plan, checklist and info cards)',
  request: { body: { content: { 'application/json': { schema: z.unknown() } }, required: true } },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: z.object({ tripId: z.uuid() }) } },
    },
    401: errorResponses[401],
    422: errorResponses[422],
  },
})

export function backupRoutes(service: BackupService) {
  return createRouter()
    .openapi(itemCalendar, async (c) => {
      const { tripId, itemId } = c.req.valid('param')
      const { ics } = await service.calendarItem(requireUser(c), tripId, itemId)
      return c.body(ics, 200, {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': 'inline; filename="event.ics"',
      })
    })
    .openapi(calendar, async (c) => {
      const { name, ics } = await service.calendar(requireUser(c), c.req.valid('param').tripId)
      return c.body(ics, 200, {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': `inline; filename="${encodeURIComponent(fileName(name, 'ics'))}"`,
      })
    })
    .openapi(exportTrip, async (c) => {
      const backup = await service.export(requireUser(c), c.req.valid('param').tripId)
      c.header(
        'content-disposition',
        `attachment; filename="${encodeURIComponent(fileName(backup.trip.name, 'iplan.json'))}"`,
      )
      return c.json(backup, 200)
    })
    .openapi(importTrip, async (c) =>
      c.json(await service.import(requireUser(c), await c.req.json()), 201),
    )
}
