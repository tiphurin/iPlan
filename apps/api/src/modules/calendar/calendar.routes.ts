import { createRoute, z } from '@hono/zod-openapi'
import { CalendarFeedDto } from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { notFound } from '../../shared/errors'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { CalendarService } from './calendar.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const tags = ['Calendar']
const tripParam = z.object({ tripId: z.uuid() })

const link = createRoute({
  method: 'get',
  path: '/trips/{tripId}/calendar-feed',
  tags,
  summary: 'My subscribe links for this trip (iPhone, Google, any calendar)',
  request: { params: tripParam },
  responses: {
    200: { description: 'Links', content: json(CalendarFeedDto) },
    401: errorResponses[401],
    404: errorResponses[404],
  },
})
const rotate = createRoute({
  method: 'post',
  path: '/trips/{tripId}/calendar-feed/rotate',
  tags,
  summary: 'Make a new secret link; the old one stops working',
  request: { params: tripParam },
  responses: {
    200: { description: 'Links', content: json(CalendarFeedDto) },
    401: errorResponses[401],
    404: errorResponses[404],
  },
})
const feed = createRoute({
  method: 'get',
  path: '/calendar/{file}',
  tags,
  summary: 'Calendar feed for subscribing apps (secret link, no sign-in)',
  request: { params: z.object({ file: z.string().regex(/^[\w-]{16,}\.ics$/) }) },
  responses: {
    200: { description: 'ICS', content: { 'text/calendar': { schema: z.string() } } },
    404: errorResponses[404],
  },
})

/** The address the app was opened with, so links also work from a phone on the LAN. */
function originOf(request: Request): string | undefined {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!host) return undefined
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    new URL(request.url).protocol.replace(':', '')
  return `${proto}://${host}`
}

export function calendarRoutes(service: CalendarService) {
  return createRouter()
    .openapi(link, async (c) =>
      c.json(
        await service.link(requireUser(c), c.req.valid('param').tripId, originOf(c.req.raw)),
        200,
      ),
    )
    .openapi(rotate, async (c) =>
      c.json(
        await service.rotate(requireUser(c), c.req.valid('param').tripId, originOf(c.req.raw)),
        200,
      ),
    )
    .openapi(feed, async (c) => {
      const token = c.req.valid('param').file.replace(/\.ics$/, '')
      if (!token) throw notFound('Calendar')
      const { ics } = await service.ics(token)
      return c.body(ics, 200, {
        'content-type': 'text/calendar; charset=utf-8',
        // Calendar apps poll; let them cache briefly but never share between users.
        'cache-control': 'private, max-age=900',
      })
    })
}
