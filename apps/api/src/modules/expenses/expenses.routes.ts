import { createRoute, z } from '@hono/zod-openapi'
import {
  ExpenseDto,
  ExpenseInput,
  ExpenseSummaryDto,
  PoolContributionDto,
  PoolContributionInput,
  PoolContributionUpdateInput,
  PoolDto,
  TripMoneySettingsInput,
} from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { ExpensesService } from './expenses.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const tags = ['Expenses']
const TripParams = z.object({ tripId: z.uuid() })
const ExpenseParams = z.object({ expenseId: z.uuid() })
const denied = { 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] }
const one = { description: 'Expense', content: json(ExpenseDto) }

const list = createRoute({
  method: 'get',
  path: '/trips/{tripId}/expenses',
  tags,
  summary: 'All expenses with shares',
  request: { params: TripParams },
  responses: { 200: { description: 'Expenses', content: json(z.array(ExpenseDto)) }, ...denied },
})
const summary = createRoute({
  method: 'get',
  path: '/trips/{tripId}/expenses/summary',
  tags,
  summary: 'Totals, who owes whom, per day and per category (base currency)',
  request: { params: TripParams },
  responses: { 200: { description: 'Summary', content: json(ExpenseSummaryDto) }, ...denied },
})
const csv = createRoute({
  method: 'get',
  path: '/trips/{tripId}/expenses.csv',
  tags,
  summary: 'Download expenses as CSV (headers in Thai or English), named after the trip',
  request: {
    params: TripParams,
    query: z.object({ lang: z.enum(['th', 'en']).optional() }),
  },
  responses: {
    200: { description: 'CSV file', content: { 'text/csv': { schema: z.string() } } },
    ...denied,
  },
})
const create = createRoute({
  method: 'post',
  path: '/trips/{tripId}/expenses',
  tags,
  summary: 'Add an expense (editor or owner)',
  request: { params: TripParams, body: { content: json(ExpenseInput), required: true } },
  responses: { 201: one, ...denied, 422: errorResponses[422] },
})
const update = createRoute({
  method: 'put',
  path: '/expenses/{expenseId}',
  tags,
  summary: 'Replace an expense (editor or owner)',
  request: { params: ExpenseParams, body: { content: json(ExpenseInput), required: true } },
  responses: { 200: one, ...denied, 422: errorResponses[422] },
})
const remove = createRoute({
  method: 'delete',
  path: '/expenses/{expenseId}',
  tags,
  summary: 'Delete an expense (editor or owner)',
  request: { params: ExpenseParams },
  responses: { 204: { description: 'Deleted' }, ...denied },
})
const settings = createRoute({
  method: 'patch',
  path: '/trips/{tripId}/money',
  tags,
  summary: 'Exchange rates and daily budget (editor or owner)',
  request: { params: TripParams, body: { content: json(TripMoneySettingsInput), required: true } },
  responses: { 204: { description: 'Saved' }, ...denied, 422: errorResponses[422] },
})

const ContributionParams = z.object({ contributionId: z.uuid() })
const poolTags = ['Pool']
const contribution = { description: 'Contribution', content: json(PoolContributionDto) }
const poolGet = createRoute({
  method: 'get',
  path: '/trips/{tripId}/pool',
  tags: poolTags,
  summary: 'Money put into the shared pool, what it spent and who put in how much',
  request: { params: TripParams },
  responses: { 200: { description: 'Pool', content: json(PoolDto) }, ...denied },
})
const contribute = createRoute({
  method: 'post',
  path: '/trips/{tripId}/pool/contributions',
  tags: poolTags,
  summary: 'Record money a member put into the pool (editor or owner)',
  request: { params: TripParams, body: { content: json(PoolContributionInput), required: true } },
  responses: { 201: contribution, ...denied, 422: errorResponses[422] },
})
const contributionUpdate = createRoute({
  method: 'patch',
  path: '/pool-contributions/{contributionId}',
  tags: poolTags,
  summary: 'Change a pool contribution (editor or owner)',
  request: {
    params: ContributionParams,
    body: { content: json(PoolContributionUpdateInput), required: true },
  },
  responses: { 200: contribution, ...denied, 422: errorResponses[422] },
})
const contributionRemove = createRoute({
  method: 'delete',
  path: '/pool-contributions/{contributionId}',
  tags: poolTags,
  summary: 'Delete a pool contribution (editor or owner)',
  request: { params: ContributionParams },
  responses: { 204: { description: 'Deleted' }, ...denied },
})

export function expenseRoutes(service: ExpensesService) {
  return createRouter()
    .openapi(list, async (c) =>
      c.json(await service.list(requireUser(c), c.req.valid('param').tripId), 200),
    )
    .openapi(summary, async (c) =>
      c.json(await service.summary(requireUser(c), c.req.valid('param').tripId), 200),
    )
    .openapi(csv, async (c) => {
      const tripId = c.req.valid('param').tripId
      const { fileName, body } = await service.csv(
        requireUser(c),
        tripId,
        c.req.valid('query').lang ?? 'en',
      )
      // ASCII fallback plus the real (often Thai) name, as RFC 6266 describes.
      const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')
      return c.body(body, 200, {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      })
    })
    .openapi(create, async (c) =>
      c.json(
        await service.create(requireUser(c), c.req.valid('param').tripId, c.req.valid('json')),
        201,
      ),
    )
    .openapi(update, async (c) =>
      c.json(
        await service.update(requireUser(c), c.req.valid('param').expenseId, c.req.valid('json')),
        200,
      ),
    )
    .openapi(remove, async (c) => {
      await service.remove(requireUser(c), c.req.valid('param').expenseId)
      return c.body(null, 204)
    })
    .openapi(settings, async (c) => {
      await service.updateMoneySettings(
        requireUser(c),
        c.req.valid('param').tripId,
        c.req.valid('json'),
      )
      return c.body(null, 204)
    })
    .openapi(poolGet, async (c) =>
      c.json(await service.pool(requireUser(c), c.req.valid('param').tripId), 200),
    )
    .openapi(contribute, async (c) =>
      c.json(
        await service.addContribution(
          requireUser(c),
          c.req.valid('param').tripId,
          c.req.valid('json'),
        ),
        201,
      ),
    )
    .openapi(contributionUpdate, async (c) =>
      c.json(
        await service.updateContribution(
          requireUser(c),
          c.req.valid('param').contributionId,
          c.req.valid('json'),
        ),
        200,
      ),
    )
    .openapi(contributionRemove, async (c) => {
      await service.removeContribution(requireUser(c), c.req.valid('param').contributionId)
      return c.body(null, 204)
    })
}
