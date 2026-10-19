import { createRoute, z } from '@hono/zod-openapi'
import {
  EntryPaidInput,
  LedgerDetailDto,
  LedgerDto,
  LedgerEntryDto,
  LedgerEntryInput,
  LedgerInput,
  InviteUserInput,
  MonthStatusInput,
  PendingInviteDto,
  SettleInput,
} from '@iplan/contracts'
import { requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { LedgersService } from './ledgers.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const tags = ['Shared money']
const common = {
  401: errorResponses[401],
  403: errorResponses[403],
  404: errorResponses[404],
  422: errorResponses[422],
}
const ledgerId = z.object({ ledgerId: z.uuid() })
const entryId = z.object({ entryId: z.uuid() })

const list = createRoute({
  method: 'get',
  path: '/ledgers',
  tags,
  summary: 'Ledgers I am in, with my balance',
  responses: { 200: { description: 'Ledgers', content: json(z.array(LedgerDto)) }, ...common },
})
const create = createRoute({
  method: 'post',
  path: '/ledgers',
  tags,
  summary: 'Start a shared ledger',
  request: { body: { content: json(LedgerInput), required: true } },
  responses: { 201: { description: 'Ledger', content: json(LedgerDto) }, ...common },
})
const detail = createRoute({
  method: 'get',
  path: '/ledgers/{ledgerId}',
  tags,
  summary: 'Entries, balances and who should pay whom',
  request: { params: ledgerId },
  responses: { 200: { description: 'Ledger', content: json(LedgerDetailDto) }, ...common },
})
const rename = createRoute({
  method: 'patch',
  path: '/ledgers/{ledgerId}',
  tags,
  summary: 'Rename (owner)',
  request: { params: ledgerId, body: { content: json(LedgerInput), required: true } },
  responses: { 200: { description: 'Ledger', content: json(LedgerDto) }, ...common },
})
const remove = createRoute({
  method: 'delete',
  path: '/ledgers/{ledgerId}',
  tags,
  summary: 'Delete with all entries (owner)',
  request: { params: ledgerId },
  responses: { 204: { description: 'Deleted' }, ...common },
})
const invite = createRoute({
  method: 'post',
  path: '/ledgers/{ledgerId}/invites',
  tags,
  summary: 'Invite someone from your circles (owner); they join after accepting',
  request: { params: ledgerId, body: { content: json(InviteUserInput), required: true } },
  responses: {
    200: { description: 'Pending invitations', content: json(z.array(PendingInviteDto)) },
    ...common,
    409: errorResponses[409],
  },
})
const removeMember = createRoute({
  method: 'delete',
  path: '/ledgers/{ledgerId}/members/{userId}',
  tags,
  summary: 'Remove a member (owner) or leave',
  request: { params: z.object({ ledgerId: z.uuid(), userId: z.string().min(1) }) },
  responses: { 204: { description: 'Removed' }, ...common, 409: errorResponses[409] },
})
const addEntry = createRoute({
  method: 'post',
  path: '/ledgers/{ledgerId}/entries',
  tags,
  summary: 'Add a shared cost',
  request: { params: ledgerId, body: { content: json(LedgerEntryInput), required: true } },
  responses: { 201: { description: 'Entry', content: json(LedgerEntryDto) }, ...common },
})
const settleUp = createRoute({
  method: 'post',
  path: '/ledgers/{ledgerId}/settlements',
  tags,
  summary: 'Record a payment back between two members',
  request: { params: ledgerId, body: { content: json(SettleInput), required: true } },
  responses: { 201: { description: 'Entry', content: json(LedgerEntryDto) }, ...common },
})
const monthStatus = createRoute({
  method: 'put',
  path: '/ledgers/{ledgerId}/months/{month}/status',
  tags,
  summary: 'Set a month to unpaid, partly paid or paid',
  request: {
    params: z.object({ ledgerId: z.uuid(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }),
    body: { content: json(MonthStatusInput), required: true },
  },
  responses: { 200: { description: 'Ledger', content: json(LedgerDetailDto) }, ...common },
})
const entryPaid = createRoute({
  method: 'put',
  path: '/ledger-entries/{entryId}/paid',
  tags,
  summary: 'Mark one expense as paid back (or not)',
  request: { params: entryId, body: { content: json(EntryPaidInput), required: true } },
  responses: { 200: { description: 'Entry', content: json(LedgerEntryDto) }, ...common },
})
const getEntry = createRoute({
  method: 'get',
  path: '/ledger-entries/{entryId}',
  tags,
  summary: 'One entry',
  request: { params: entryId },
  responses: { 200: { description: 'Entry', content: json(LedgerEntryDto) }, ...common },
})
const updateEntry = createRoute({
  method: 'put',
  path: '/ledger-entries/{entryId}',
  tags,
  summary: 'Replace a shared cost',
  request: { params: entryId, body: { content: json(LedgerEntryInput), required: true } },
  responses: { 200: { description: 'Entry', content: json(LedgerEntryDto) }, ...common },
})
const deleteEntry = createRoute({
  method: 'delete',
  path: '/ledger-entries/{entryId}',
  tags,
  summary: 'Delete an entry or settlement',
  request: { params: entryId },
  responses: { 204: { description: 'Deleted' }, ...common },
})

export function ledgerRoutes(service: LedgersService) {
  return createRouter()
    .openapi(list, async (c) => c.json(await service.list(requireUser(c)), 200))
    .openapi(create, async (c) =>
      c.json(await service.create(requireUser(c), c.req.valid('json')), 201),
    )
    .openapi(detail, async (c) =>
      c.json(await service.get(requireUser(c), c.req.valid('param').ledgerId), 200),
    )
    .openapi(rename, async (c) =>
      c.json(
        await service.rename(requireUser(c), c.req.valid('param').ledgerId, c.req.valid('json')),
        200,
      ),
    )
    .openapi(remove, async (c) => {
      await service.remove(requireUser(c), c.req.valid('param').ledgerId)
      return c.body(null, 204)
    })
    .openapi(invite, async (c) =>
      c.json(
        await service.invite(
          requireUser(c),
          c.req.valid('param').ledgerId,
          c.req.valid('json').userId,
        ),
        200,
      ),
    )
    .openapi(removeMember, async (c) => {
      const { ledgerId: id, userId } = c.req.valid('param')
      await service.removeMember(requireUser(c), id, userId)
      return c.body(null, 204)
    })
    .openapi(addEntry, async (c) =>
      c.json(
        await service.addEntry(requireUser(c), c.req.valid('param').ledgerId, c.req.valid('json')),
        201,
      ),
    )
    .openapi(settleUp, async (c) =>
      c.json(
        await service.settleUp(requireUser(c), c.req.valid('param').ledgerId, c.req.valid('json')),
        201,
      ),
    )
    .openapi(monthStatus, async (c) => {
      const { ledgerId: id, month } = c.req.valid('param')
      return c.json(
        await service.setMonthStatus(requireUser(c), id, month, c.req.valid('json')),
        200,
      )
    })
    .openapi(entryPaid, async (c) =>
      c.json(
        await service.setEntryPaid(
          requireUser(c),
          c.req.valid('param').entryId,
          c.req.valid('json').paidBack,
        ),
        200,
      ),
    )
    .openapi(getEntry, async (c) =>
      c.json(await service.getEntry(requireUser(c), c.req.valid('param').entryId), 200),
    )
    .openapi(updateEntry, async (c) =>
      c.json(
        await service.updateEntry(
          requireUser(c),
          c.req.valid('param').entryId,
          c.req.valid('json'),
        ),
        200,
      ),
    )
    .openapi(deleteEntry, async (c) => {
      await service.deleteEntry(requireUser(c), c.req.valid('param').entryId)
      return c.body(null, 204)
    })
}
