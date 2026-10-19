import { createRoute, z } from '@hono/zod-openapi'
import type { ErrorResponse, FeatureKey } from '@iplan/contracts'
import { createMiddleware } from 'hono/factory'
import { Scalar } from '@scalar/hono-api-reference'
import type { AuthGateway } from './infra/auth'
import type { StorageProvider } from './infra/storage'
import { accessRoutes } from './modules/access/access.routes'
import type { AccessService } from './modules/access/access.service'
import { adminRoutes } from './modules/admin/admin.routes'
import type { AdminService } from './modules/admin/admin.service'
import { backupRoutes } from './modules/backup/backup.routes'
import type { BackupService } from './modules/backup/backup.service'
import { attachmentRoutes } from './modules/attachments/attachments.routes'
import type { AttachmentsService } from './modules/attachments/attachments.service'
import type { DevUser } from './infra/dev-login'
import { checklistRoutes } from './modules/checklist/checklist.routes'
import type { ChecklistService } from './modules/checklist/checklist.service'
import { expenseRoutes } from './modules/expenses/expenses.routes'
import type { ExpensesService } from './modules/expenses/expenses.service'
import { financeRoutes } from './modules/finance/finance.routes'
import type { FinanceService } from './modules/finance/finance.service'
import { infoCardRoutes } from './modules/info-cards/info-cards.routes'
import type { InfoCardsService } from './modules/info-cards/info-cards.service'
import { itemRoutes } from './modules/items/items.routes'
import type { ItemsService } from './modules/items/items.service'
import { meRoutes } from './modules/me/me.routes'
import { ledgerRoutes } from './modules/ledgers/ledgers.routes'
import type { LedgersService } from './modules/ledgers/ledgers.service'
import { memberRoutes } from './modules/members/members.routes'
import type { MembersService } from './modules/members/members.service'
import type { MeService } from './modules/me/me.service'
import { tripRoutes } from './modules/trips/trips.routes'
import type { TripsService } from './modules/trips/trips.service'
import type { AppEnv, SessionAccount } from './shared/context'
import { AppError } from './shared/errors'
import { createRouter, errorResponses } from './shared/openapi'

export interface AppDeps {
  auth: AuthGateway
  /** Present only when DEV_LOGIN_ENABLED is true. */
  devLogin?: {
    signIn(email: string): Promise<Response>
    users(): Promise<DevUser[]>
  }
  storage: StorageProvider
  /** Lower-cased emails that are always active admins (ADMIN_EMAILS). */
  adminEmails?: readonly string[]
  services: {
    access: AccessService
    me: MeService
    trips: TripsService
    items: ItemsService
    members: MembersService
    checklist: ChecklistService
    infoCards: InfoCardsService
    expenses: ExpensesService
    attachments: AttachmentsService
    finance: FinanceService
    ledgers: LedgersService
    admin: AdminService
    backup: BackupService
  }
}

const devLoginRoute = createRoute({
  method: 'post',
  path: '/dev/login',
  tags: ['Dev'],
  summary: 'Sign in as any local user (local development only)',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: z.object({ email: z.email().default('dev@iplan.local') }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Signed in; session cookie set' },
    422: errorResponses[422],
  },
})

const devUsersRoute = createRoute({
  method: 'get',
  path: '/dev/users',
  tags: ['Dev'],
  summary: 'People you can sign in as (local development only)',
  responses: {
    200: {
      description: 'Users',
      content: {
        'application/json': {
          schema: z.array(
            z.object({ name: z.string(), email: z.string(), role: z.string(), status: z.string() }),
          ),
        },
      },
    },
  },
})

/** API paths that belong to each feature; requests are refused unless the feature is granted. */
export const FEATURE_PATHS: Record<FeatureKey, readonly string[]> = {
  trips: [
    '/trips',
    '/trips/*',
    '/items/*',
    '/checklist/*',
    '/expenses/*',
    '/info/*',
    '/invites/*',
    '/join/*',
  ],
  finance: ['/finance/*'],
  shared: ['/ledgers', '/ledgers/*', '/ledger-entries/*'],
}

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
  const adminEmails = new Set(deps.adminEmails ?? [])
  app.use('*', async (c, next) => {
    const found = await deps.auth.getSessionUser(c.req.raw.headers)
    // A suspended account is treated as signed out even if a session survives.
    let account: SessionAccount | null = null
    if (found && !found.banned) {
      const admin = found.role === 'admin' || adminEmails.has(found.email.toLowerCase())
      account = {
        id: found.id,
        name: found.name,
        email: found.email,
        role: admin ? 'admin' : 'user',
        // Admins are never stuck on the waiting list.
        status: admin || found.status === 'active' ? 'active' : 'pending',
      }
    }
    c.set('account', account)
    c.set(
      'user',
      account?.status === 'active'
        ? { id: account.id, name: account.name, email: account.email, role: account.role }
        : null,
    )
    await next()
  })

  for (const [feature, paths] of Object.entries(FEATURE_PATHS)) {
    const gate = createMiddleware<AppEnv>(async (c, next) => {
      const user = c.get('user')
      // Signed-out and pending requests fall through to the route's own 401 / 403.
      if (user) await deps.services.access.requireFeature(user, feature as FeatureKey)
      await next()
    })
    for (const path of paths) app.use(path, gate)
  }

  app.get('/health', (c) => c.json({ status: 'ok' }))

  const devLogin = deps.devLogin
  if (devLogin) {
    app.openapi(devLoginRoute, async (c) => devLogin.signIn(c.req.valid('json').email))
    app.openapi(devUsersRoute, async (c) => c.json(await devLogin.users(), 200))
  }

  app.route('/', meRoutes(deps.services.me, deps.storage))
  app.route('/', backupRoutes(deps.services.backup))
  app.route('/', tripRoutes(deps.services.trips))
  app.route('/', itemRoutes(deps.services.items))
  app.route('/', memberRoutes(deps.services.members))
  app.route('/', checklistRoutes(deps.services.checklist))
  app.route('/', infoCardRoutes(deps.services.infoCards))
  app.route('/', expenseRoutes(deps.services.expenses))
  app.route('/', attachmentRoutes(deps.services.attachments, deps.storage))
  app.route('/', financeRoutes(deps.services.finance))
  app.route('/', ledgerRoutes(deps.services.ledgers))
  app.route('/', adminRoutes(deps.services.admin))
  app.route('/', accessRoutes(deps.services.access))

  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'iPlan API', version: '0.1.0' },
  })
  app.get('/docs', Scalar({ url: '/api/openapi.json', pageTitle: 'iPlan API' }))

  return app
}

export type App = ReturnType<typeof createApp>
