import { createRoute, z } from '@hono/zod-openapi'
import {
  FinanceCategoryDto,
  FinanceCategoryInput,
  FinanceMonth,
  FinanceOverviewDto,
  MonthDto,
  OverrideInput,
  RecurringRuleDto,
  RecurringRuleInput,
  TransactionDto,
  TransactionInput,
} from '@iplan/contracts'
import type { Month } from '@iplan/core'
import { requireAdmin, requireUser } from '../../shared/auth-guard'
import { createRouter, errorResponses } from '../../shared/openapi'
import type { FinanceService } from './finance.service'

const json = <T>(schema: T) => ({ 'application/json': { schema } })
const tags = ['Finance']
const Id = z.object({ id: z.uuid() })
const errors = { 401: errorResponses[401], 404: errorResponses[404], 422: errorResponses[422] }
const done = { 204: { description: 'Done' }, ...errors }

const r = {
  monthOf: createRoute({
    method: 'get',
    path: '/admin/users/{userId}/finance/months/{month}',
    tags: ['Admin'],
    summary: "Admin: someone's month (read-only, logged)",
    request: { params: z.object({ userId: z.string().min(1), month: FinanceMonth }) },
    responses: { 200: { description: 'Month', content: json(MonthDto) }, ...errors },
  }),
  month: createRoute({
    method: 'get',
    path: '/finance/months/{month}',
    tags,
    summary: 'One month: recurring lines with overrides, one-off transactions, summary, budgets',
    request: { params: z.object({ month: FinanceMonth }) },
    responses: { 200: { description: 'Month', content: json(MonthDto) }, ...errors },
  }),
  overview: createRoute({
    method: 'get',
    path: '/finance/overview',
    tags,
    summary: 'Monthly summaries for charts',
    request: { query: z.object({ from: FinanceMonth, to: FinanceMonth }) },
    responses: { 200: { description: 'Overview', content: json(FinanceOverviewDto) }, ...errors },
  }),
  categories: createRoute({
    method: 'get',
    path: '/finance/categories',
    tags,
    summary: 'Categories (defaults are created on first use)',
    responses: {
      200: { description: 'Categories', content: json(z.array(FinanceCategoryDto)) },
      ...errors,
    },
  }),
  createCategory: createRoute({
    method: 'post',
    path: '/finance/categories',
    tags,
    summary: 'Add a category',
    request: { body: { content: json(FinanceCategoryInput), required: true } },
    responses: { 201: { description: 'Category', content: json(FinanceCategoryDto) }, ...errors },
  }),
  updateCategory: createRoute({
    method: 'put',
    path: '/finance/categories/{id}',
    tags,
    summary: 'Edit a category or its monthly budget',
    request: { params: Id, body: { content: json(FinanceCategoryInput), required: true } },
    responses: { 200: { description: 'Category', content: json(FinanceCategoryDto) }, ...errors },
  }),
  deleteCategory: createRoute({
    method: 'delete',
    path: '/finance/categories/{id}',
    tags,
    summary: 'Delete a category',
    request: { params: Id },
    responses: done,
  }),
  rules: createRoute({
    method: 'get',
    path: '/finance/rules',
    tags,
    summary: 'Recurring income, deductions and fixed costs',
    responses: {
      200: { description: 'Rules', content: json(z.array(RecurringRuleDto)) },
      ...errors,
    },
  }),
  createRule: createRoute({
    method: 'post',
    path: '/finance/rules',
    tags,
    summary: 'Add a recurring line',
    request: { body: { content: json(RecurringRuleInput), required: true } },
    responses: { 201: { description: 'Rule', content: json(RecurringRuleDto) }, ...errors },
  }),
  updateRule: createRoute({
    method: 'put',
    path: '/finance/rules/{id}',
    tags,
    summary: 'Edit a recurring line (all months)',
    request: { params: Id, body: { content: json(RecurringRuleInput), required: true } },
    responses: { 200: { description: 'Rule', content: json(RecurringRuleDto) }, ...errors },
  }),
  deleteRule: createRoute({
    method: 'delete',
    path: '/finance/rules/{id}',
    tags,
    summary: 'Delete a recurring line',
    request: { params: Id },
    responses: done,
  }),
  setOverride: createRoute({
    method: 'put',
    path: '/finance/rules/{id}/months/{month}',
    tags,
    summary: 'Adjust or skip a recurring line for one month',
    request: {
      params: z.object({ id: z.uuid(), month: FinanceMonth }),
      body: { content: json(OverrideInput), required: true },
    },
    responses: done,
  }),
  clearOverride: createRoute({
    method: 'delete',
    path: '/finance/rules/{id}/months/{month}',
    tags,
    summary: 'Go back to the planned amount for that month',
    request: { params: z.object({ id: z.uuid(), month: FinanceMonth }) },
    responses: done,
  }),
  createTransaction: createRoute({
    method: 'post',
    path: '/finance/transactions',
    tags,
    summary: 'Add one-off income or spending',
    request: { body: { content: json(TransactionInput), required: true } },
    responses: { 201: { description: 'Transaction', content: json(TransactionDto) }, ...errors },
  }),
  updateTransaction: createRoute({
    method: 'put',
    path: '/finance/transactions/{id}',
    tags,
    summary: 'Edit a transaction',
    request: { params: Id, body: { content: json(TransactionInput), required: true } },
    responses: { 200: { description: 'Transaction', content: json(TransactionDto) }, ...errors },
  }),
  deleteTransaction: createRoute({
    method: 'delete',
    path: '/finance/transactions/{id}',
    tags,
    summary: 'Delete a transaction',
    request: { params: Id },
    responses: done,
  }),
}

export function financeRoutes(service: FinanceService) {
  return createRouter()
    .openapi(r.monthOf, async (c) => {
      const { userId, month } = c.req.valid('param')
      return c.json(await service.monthOf(requireAdmin(c), userId, month as Month), 200)
    })
    .openapi(r.month, async (c) =>
      c.json(await service.month(requireUser(c), c.req.valid('param').month as Month), 200),
    )
    .openapi(r.overview, async (c) => {
      const { from, to } = c.req.valid('query')
      return c.json(await service.overview(requireUser(c), from as Month, to as Month), 200)
    })
    .openapi(r.categories, async (c) => c.json(await service.listCategories(requireUser(c)), 200))
    .openapi(r.createCategory, async (c) =>
      c.json(await service.createCategory(requireUser(c), c.req.valid('json')), 201),
    )
    .openapi(r.updateCategory, async (c) =>
      c.json(
        await service.updateCategory(requireUser(c), c.req.valid('param').id, c.req.valid('json')),
        200,
      ),
    )
    .openapi(r.deleteCategory, async (c) => {
      await service.deleteCategory(requireUser(c), c.req.valid('param').id)
      return c.body(null, 204)
    })
    .openapi(r.rules, async (c) => c.json(await service.listRules(requireUser(c)), 200))
    .openapi(r.createRule, async (c) =>
      c.json(await service.createRule(requireUser(c), c.req.valid('json')), 201),
    )
    .openapi(r.updateRule, async (c) =>
      c.json(
        await service.updateRule(requireUser(c), c.req.valid('param').id, c.req.valid('json')),
        200,
      ),
    )
    .openapi(r.deleteRule, async (c) => {
      await service.deleteRule(requireUser(c), c.req.valid('param').id)
      return c.body(null, 204)
    })
    .openapi(r.setOverride, async (c) => {
      const { id, month } = c.req.valid('param')
      await service.setOverride(requireUser(c), id, month as Month, c.req.valid('json'))
      return c.body(null, 204)
    })
    .openapi(r.clearOverride, async (c) => {
      const { id, month } = c.req.valid('param')
      await service.clearOverride(requireUser(c), id, month as Month)
      return c.body(null, 204)
    })
    .openapi(r.createTransaction, async (c) =>
      c.json(await service.createTransaction(requireUser(c), c.req.valid('json')), 201),
    )
    .openapi(r.updateTransaction, async (c) =>
      c.json(
        await service.updateTransaction(
          requireUser(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
        200,
      ),
    )
    .openapi(r.deleteTransaction, async (c) => {
      await service.deleteTransaction(requireUser(c), c.req.valid('param').id)
      return c.body(null, 204)
    })
}
