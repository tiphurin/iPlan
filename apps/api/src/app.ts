import { createRoute, z } from '@hono/zod-openapi'
import type { ErrorResponse } from '@iplan/contracts'
import { Scalar } from '@scalar/hono-api-reference'
import type { AuthGateway } from './infra/auth'
import type { StorageProvider } from './infra/storage'
import { attachmentRoutes } from './modules/attachments/attachments.routes'
import type { AttachmentsService } from './modules/attachments/attachments.service'
import { DEV_LOGIN_EMAILS, type DevLoginEmail } from './infra/dev-login'
import { checklistRoutes } from './modules/checklist/checklist.routes'
import type { ChecklistService } from './modules/checklist/checklist.service'
import { expenseRoutes } from './modules/expenses/expenses.routes'
import type { ExpensesService } from './modules/expenses/expenses.service'
import { infoCardRoutes } from './modules/info-cards/info-cards.routes'
import type { InfoCardsService } from './modules/info-cards/info-cards.service'
import { itemRoutes } from './modules/items/items.routes'
import type { ItemsService } from './modules/items/items.service'
import { meRoutes } from './modules/me/me.routes'
import { memberRoutes } from './modules/members/members.routes'
import type { MembersService } from './modules/members/members.service'
import type { MeService } from './modules/me/me.service'
import { tripRoutes } from './modules/trips/trips.routes'
import type { TripsService } from './modules/trips/trips.service'
import type { SessionUser } from './shared/context'
import { AppError } from './shared/errors'
import { createRouter, errorResponses } from './shared/openapi'

export interface AppDeps {
  auth: AuthGateway
  /** Present only when DEV_LOGIN_ENABLED is true. */
  devLogin?: (email: DevLoginEmail) => Promise<Response>
  storage: StorageProvider
  services: {
    me: MeService
    trips: TripsService
    items: ItemsService
    members: MembersService
    checklist: ChecklistService
    infoCards: InfoCardsService
    expenses: ExpensesService
    attachments: AttachmentsService
  }
}

const devLoginRoute = createRoute({
  method: 'post',
  path: '/dev/login',
  tags: ['Dev'],
  summary: 'Sign in as a demo user (local development only)',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: z.object({ email: z.enum(DEV_LOGIN_EMAILS).default('dev@iplan.local') }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Signed in; session cookie set' },
    422: errorResponses[422],
  },
})

/** Builds the HTTP API. Everything is mounted under /api so it can live inside Next.js. */
export function createApp(deps: AppDeps) {
  const app = createRouter().basePath('/api')

  app.onError((error, c) => {
    if (error instanceof AppError) {
      const body: ErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields && { fields: error.fields }),
        },
      }
      return c.json(body, error.status)
    }
    console.error(error)
    const body: ErrorResponse = { error: { code: 'INTERNAL', message: 'Something went wrong' } }
    return c.json(body, 500)
  })

  app.notFound((c) => {
    const body: ErrorResponse = { error: { code: 'NOT_FOUND', message: 'No such endpoint' } }
    return c.json(body, 404)
  })

  // Better Auth owns /api/auth/* (Google sign-in, sessions, sign-out).
  app.on(['GET', 'POST'], '/auth/*', (c) => deps.auth.handler(c.req.raw))

  // Resolve the session once per request for everything else.
  app.use('*', async (c, next) => {
    const found = await deps.auth.getSessionUser(c.req.raw.headers)
    const user: SessionUser | null = found
      ? {
          id: found.id,
          name: found.name,
          email: found.email,
          role: found.role === 'admin' ? 'admin' : 'user',
        }
      : null
    c.set('user', user)
    await next()
  })

  app.get('/health', (c) => c.json({ status: 'ok' }))

  const devLogin = deps.devLogin
  if (devLogin) {
    app.openapi(devLoginRoute, async (c) => devLogin(c.req.valid('json').email))
  }

  app.route('/', meRoutes(deps.services.me))
  app.route('/', tripRoutes(deps.services.trips))
  app.route('/', itemRoutes(deps.services.items))
  app.route('/', memberRoutes(deps.services.members))
  app.route('/', checklistRoutes(deps.services.checklist))
  app.route('/', infoCardRoutes(deps.services.infoCards))
  app.route('/', expenseRoutes(deps.services.expenses))
  app.route('/', attachmentRoutes(deps.services.attachments, deps.storage))

  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'iPlan API', version: '0.1.0' },
  })
  app.get('/docs', Scalar({ url: '/api/openapi.json', pageTitle: 'iPlan API' }))

  return app
}

export type App = ReturnType<typeof createApp>
