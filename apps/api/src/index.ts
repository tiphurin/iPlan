import { createDb } from '@iplan/db'
import { type App, createApp } from './app'
import { readEnv } from './env'
import { authGateway, createAuth } from './infra/auth'
import { devLogin } from './infra/dev-login'
import { DrizzleItemsRepository } from './modules/items/items.repository'
import { ItemsService } from './modules/items/items.service'
import { DrizzleMeRepository } from './modules/me/me.repository'
import { MeService } from './modules/me/me.service'
import { DrizzleTripsRepository } from './modules/trips/trips.repository'
import { TripsService } from './modules/trips/trips.service'
import { AuditRepository } from './shared/audit'

export { createApp } from './app'
export type { App, AppDeps } from './app'

/** Wires real dependencies from environment variables. */
export function buildApp(env = readEnv()): App {
  const db = createDb(env.databaseUrl)
  const auth = createAuth(db, env)
  const audit = new AuditRepository(db)
  const trips = new TripsService(new DrizzleTripsRepository(db), audit)
  return createApp({
    auth: authGateway(auth),
    ...(env.devLoginEnabled && { devLogin: (email) => devLogin(auth, email) }),
    services: {
      me: new MeService(new DrizzleMeRepository(db)),
      trips,
      items: new ItemsService(new DrizzleItemsRepository(db), trips, audit),
    },
  })
}

let instance: App | undefined

/** One app (and one DB pool) per server process. */
export function getApp(): App {
  instance ??= buildApp()
  return instance
}
